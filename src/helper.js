const axios = require('axios');
const { hexToUint8Array } = require('eosjs/dist/eosjs-serialize');
const eosECC = require("eosjs-ecc");

module.exports = {
 check(predicate, errorMessage) {
    if(!predicate) {
      throw Error(errorMessage);
    }
  },
  async apiSend(req, loginCredentials) {
    let res;
    try {
      res = await req();
    } catch(e) {
      if(!loginCredentials || 
         (e.response.status != 401 && e.response.status != 403)) {
        throw e
      }
      await this.login(loginCredentials);
      res = await req();
    }
    return res;
  },
  async apiPost(url, body, loginCredentials) {
    return await this.apiSend(() => axios({
        method: 'post', 
        url: url, 
        data: body, 
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text-plain, */*",
            "X-Requested-With": "XMLHttpRequest"
        }
    }), loginCredentials);
  },
  async apiGet(url, loginCredentials) {
    return await this.apiSend(() => axios({
        method: 'get', 
        url: url,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text-plain, */*",
            "X-Requested-With": "XMLHttpRequest"
        }
    }), loginCredentials);
  },
  async login ({put_endpoint, account_name, account_pk}) {
    const nounce = await eosECC.randomKey();
    const res = await this.apiPost(`${put_endpoint}/login`, {
      accountName: account_name,
      signature: eosECC.sign(nounce, account_pk),
      nounce      
    })
    axios.defaults.headers.common['Authorization'] = 'Bearer ' + res.data.token;
  },
  async cosignTransact(eos, trxArgs, broadcast) {
    if (!eos.chainId) {
        const info = await eos.rpc.get_info();
        eos.chainId = info.chain_id;
    }
  
    const trxBin = hexToUint8Array(trxArgs.packed_trx.serializedTransaction);
    const availableKeys = await eos.signatureProvider.getAvailableKeys();
    const trx = await eos.deserializeTransactionWithActions(trxBin);
    const abis = await eos.getTransactionAbis(trx);
    const trxFinal = await eos.signatureProvider.sign({
        chainId: eos.chainId,
        requiredKeys: availableKeys,
        serializedTransaction: trxBin,
        abis,
    });
    trxFinal.signatures.unshift(trxArgs.packed_trx.signatures[0]);
  
    if(broadcast) {
      try{
        return await eos.pushSignedTransaction(trxFinal);
      } catch(ex) {
        console.log(ex.json.error.details)
        throw ex;
      }
    } else {
      return trxFinal;
    }
  }
}