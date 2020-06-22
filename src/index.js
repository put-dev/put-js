const isNode =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

const axios = require('axios');
const { Api, JsonRpc } = require("eosjs");
const { JsSignatureProvider } = require("eosjs/dist/eosjs-jssig");
const { hexToUint8Array } = require('eosjs/dist/eosjs-serialize');
const eosECC = require("eosjs-ecc");

let fetch;
if (isNode) {
  fetch = require("node-fetch");
  const util = require("util");
  TextDecoder = util.TextDecoder;
  TextEncoder = util.TextEncoder;
}

function check(predicate, errorMessage) {
  if(!predicate) {
    throw Error(errorMessage);
  }
}

function apiPost(url, body) {
  return axios({
    method: 'post', 
    url: url, 
    data: body, 
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text-plain, */*",
      "X-Requested-With": "XMLHttpRequest"
    }
  });
}

function apiGet(url) {
  return axios({
    method: 'get', 
    url: url,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text-plain, */*",
      "X-Requested-With": "XMLHttpRequest"
    }
  });
}

async function cosignTransact(eos, trxArgs, broadcast) {
  if (!eos.chainId) {
      const info = await this.rpc.get_info();
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

module.exports = function ({
  account_name, // required
  put_endpoint = null, // required if no eos_endpoint is provided
  eos_endpoint = null, // required if no put_endpoint is provided
  contract = "putinventory", // defaults to 'putinventory' string (optional)
  account_pk = "", // defaults to empty string (optional)
  account_permission = "active", // defaults to active. (optional)
  copayment = false // defaults to false. (optional)
}) {
  this.account_name = account_name;
  this.eos_endpoint = eos_endpoint;
  this.contract = contract;
  this.account_pk = account_pk;
  this.account_permission = account_permission;
  this.put_endpoint = put_endpoint;
  this.copayment = copayment;
  this.defaultAuth = [
    { actor: this.account_name, permission: this.account_permission },
  ];
  this.fixedRowRamCost = 284;

  check(account_name, "account_name required.");
  check(put_endpoint || eos_endpoint, "atleast put_endpoint or eos_endpoint is required.");
  check(!copayment || put_endpoint, "put_endpoint is required for copayment.");

  const login = async () => {
    const nounce = await eosECC.randomKey();
    const result = await apiPost(`${this.put_endpoint}/login`, {
      accountName: this.account_name,
      signature: eosECC.sign(nounce, this.account_pk),
      nounce      
    })
    axios.defaults.headers.common['Authorization'] = 'Bearer ' + result.token;
  }

  const buildEosEndpoint = async () => {
    if(this.put_endpoint && !this.eos_endpoint) {
      const info = await apiGet(`${this.put_endpoint}/info`);
      check(info.eos_endpoint, "eos_endpoint required.");
      this.eos_endpoint = info.eos_endpoint;
    }
    
    if(!this.rpc) {
      this.rpc = new JsonRpc(this.eos_endpoint, isNode ? { fetch } : {});
    }
    
    if (this.account_pk && !this.eos) {
      this.eos = new Api({
        rpc: this.rpc,
        signatureProvider: new JsSignatureProvider([this.account_pk]),
        textEncoder: new TextEncoder(),
        textDecoder: new TextDecoder(),
      });
    }

    if(this.put_endpoint && this.account_pk && !axios.defaults.headers.common['Authorization']) {
      await login();
    }
  }

  this.keypair = async function () {
    // generates a new (random) keypair
    const oKey = await eosECC.randomKey();
    const aKey = await eosECC.randomKey();

    return {
      owner: { privateKey: oKey, publicKey: eosECC.privateToPublic(oKey) },
      active: { privateKey: aKey, publicKey: eosECC.privateToPublic(aKey) }
    };
  };

  this.verify = async function (accountName, privateKey) {
    // verifies a given accountName can sign with privateKey
    const account = await this.account(accountName);
    const publicKey = eosECC.privateToPublic(privateKey);
    return account.permissions.some((p) =>
      p.required_auth.keys.some((k) => k.key == publicKey)
    );
  };

  this.account = async function () {
    await buildEosEndpoint();
    // returns an account
    return this.rpc.get_account(this.account_name);
  };

  this.ram = async function () {
    // returns ram usage for an account
    const account = await this.account(this.account_name);
    return {
      free: account.ram_quota - account.ram_usage,
      total: account.ram_quota,
      used: account.ram_usage,
    };
  };

  this.credits = async function() {
    check(this.put_endpoint, "put_endpoint required.");
    check(this.account_pk, "account_pk required.");

    if(!axios.defaults.headers.common['Authorization']) {
      await login();
    }
    
    const result = await apiGet(`${this.put_endpoint}/getcreditcount`);
    return result.credits;
  }

  this.all = async function () {
    let result = [], data;

    await buildEosEndpoint();

    do {
      data = await this.rpc.get_table_rows({
        json: true,
        code: this.contract,
        scope: this.account_name,
        table: "keyval",
        lower_bound: data && data.next_key,
        limit: 100,
      });
      result.push(...data.rows);
    } while (data.more);

    return result;
  };

  this.get = async function (key, tagId = 0) {
    check(key, "key required.");

    await buildEosEndpoint();

    const hash = eosECC.sha256(tagId + "-" + key);
    const data = await this.rpc.get_table_rows({
      json: true,
      code: this.contract,
      scope: this.account_name,
      table: "keyval",
      lower_bound: hash,
      upper_bound: hash,
      limit: 1,
      key_type: "sha256",
      index_position: 2,
    });

    if (data.rows.length === 0) {
      throw new Error(`Key ${key} not found.`);
    }

    return data.rows[0];
  };

  this.add = async function (key, value, tagId = 0, authorization, options) {    
    check(key, "key required.");
    check(value, "value required.");

    await buildEosEndpoint();
    check(this.eos, "Api not authenticated. provide account private key.");

    authorization = authorization || this.defaultAuth;
    options = {
      broadcast: true,
      sign: true,
      blocksBehind: 0,
      expireSeconds: 60,
      ...options,
    };

    if(this.copayment) {
      const trxArgs = await apiPost(`${this.put_endpoint}/insertKey`, {
        tagId,
        key,
        value        
      })
      return cosignTransact(this.eos, trxArgs, options.broadcast);
    } else {
      return this.eos.transact(
        {
          actions: [
            {
              account: this.contract,
              name: "insertkey",
              authorization,
              data: {
                owner: this.account_name,
                tag_id: tagId,
                key,
                value,
              },
            },
          ],
        },
        options
      );
    }
  };

  this.set = async function (key, value, tagId = 0, authorization, options) {    
    check(key, "key required.");
    check(value, "value required.");

    await buildEosEndpoint();
    check(this.eos, "Api not authenticated. provide account private key.");

    authorization = authorization || this.defaultAuth;
    options = {
      broadcast: true,
      sign: true,
      blocksBehind: 0,
      expireSeconds: 60,
      ...options,
    };

    if(this.copayment) {
      const trxArgs = await apiPost(`${this.put_endpoint}/updateKey`, {
        tagId,
        key,
        value        
      })
      return cosignTransact(this.eos, trxArgs, options.broadcast);
    } else {
      return this.eos.transact(
        {
          actions: [
            {
              account: this.contract,
              name: "updatekey",
              authorization,
              data: {
                owner: this.account_name,
                tag_id: tagId,
                key,
                value,
              },
            },
          ],
        },
        options
      );
    }
  };

  this.rekey = async function (
    key,
    new_key,
    tagId = 0,
    authorization,
    options
  ) {    
    check(key, "key required.");
    check(new_key, "new_key required.");

    await buildEosEndpoint();
    check(this.eos, "Api not authenticated. provide account private key.");

    authorization = authorization || this.defaultAuth;
    options = {
      broadcast: true,
      sign: true,
      blocksBehind: 0,
      expireSeconds: 60,
      ...options,
    };

    if(this.copayment) {
      const trxArgs = await apiPost(`${this.put_endpoint}/reKey`, {
        tagId,
        key,
        newKey: new_key        
      })
      return cosignTransact(this.eos, trxArgs, options.broadcast);
    } else {
      return this.eos.transact(
        {
          actions: [
            {
              account: this.contract,
              name: "rekey",
              authorization,
              data: {
                owner: this.account_name,
                tag_id: tagId,
                key,
                new_key,
              },
            },
          ],
        },
        options
      );
    }
  };

  this.delete = async function (key, tagId = 0, authorization, options) {    
    check(key, "key required.");

    await buildEosEndpoint();
    check(this.eos, "Api not authenticated. provide account private key.");

    authorization = authorization || this.defaultAuth;
    options = {
      broadcast: true,
      sign: true,
      blocksBehind: 0,
      expireSeconds: 60,
      ...options,
    };

    if(this.copayment) {
      const trxArgs = await apiPost(`${this.put_endpoint}/deleteKey`, {
        tagId,
        key       
      })
      return cosignTransact(this.eos, trxArgs, options.broadcast);
    } else {
      return this.eos.transact(
        {
          actions: [
            {
              account: this.contract,
              name: "deletekey",
              authorization,
              data: {
                owner: this.account_name,
                tag_id: tagId,
                key
              },
            },
          ],
        },
        options
      );
    }
  };

  // estimators (returns bytes needed)
  const thisRoot = this;
  this.estimate = {
    add: function (key, value) {
      return thisRoot.fixedRowRamCost + key.length + value.length;
    },

    set: async function (key, value, tagId = 0) {
      const oldVal = await thisRoot.get(key, tagId);
      return key - oldVal.key + value - oldVal.value;
    },

    rekey: async function (key, new_key, tagId = 0) {
      const oldVal = await thisRoot.get(key, tagId);
      return new_key - oldVal.key;
    },

    delete: async function (key, tagId = 0) {
      const oldVal = await thisRoot.get(key, tagId);
      return -(thisRoot.fixedRowRamCost + oldVal.key + oldVal.value);
    },
  };
};
