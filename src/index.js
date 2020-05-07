const { Api, JsonRpc } = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const eosECC = require('eosjs-ecc')
const fetch = require('node-fetch')
const { TextDecoder, TextEncoder } = require('util')

module.exports = function ({
        account_name, // required
        eos_endpoint, // required
        contract = 'putinventory', // defaults to 'putinventory' string (optional)
        account_payer_pk = '', // defaults to empty string (optional)
        account_payer_permission = 'active' // defaults to active. (optional)
    }) {

    this.account_name = account_name;
    this.eos_endpoint = eos_endpoint;
    this.contract = contract;
    this.account_payer_pk = account_payer_pk;
    this.account_payer_permission = account_payer_permission;
    this.defaultAuth = [{ actor: this.account_name, permission: this.account_payer_permission}];

    this.rpc = new JsonRpc(eos_endpoint, { fetch });
    this.eos = new Api({
        rpc: this.rpc,
        signatureProvider: new JsSignatureProvider([this.account_payer_pk]),
        textEncoder: new TextEncoder(),
        textDecoder: new TextDecoder()
    });

    this.all = async function() {
        let result = [], data;

        do {
            data = await this.rpc.get_table_rows({
                json: true,
                code: this.contract,
                scope: this.account_name,
                table: 'keyval',
                lower_bound: data && data.next_key,
                limit: 100
            })
            result.push(...data.rows);
        } while(data.more);

        return result;
    }

    this.get = async function(key) {
        const hash = eosECC.sha256(key); 
        const data = await this.rpc.get_table_rows({
            json: true,
            code: this.contract,
            scope: this.account_name,
            table: 'keyval',
            lower_bound: hash,
            upper_bound: hash,
            limit: 1,
            key_type: 'sha256',
            index_position: 2
        });

        if(data.rows.length === 0) {
            throw new Error(`Key ${key} not found.`);
        }

        return data.rows[0];
    }

    this.add = async function(key, value, authorization, options) {
        authorization = authorization || this.defaultAuth
        options = { broadcast: true, sign: true, blocksBehind: 0, expireSeconds: 60, ...options }
        return this.eos.transact(
        {
            actions: [
                {
                    account: this.contract,
                    name: 'insertkey',
                    authorization,
                    data: {
                        owner: this.account_name,
                        key,
                        value
                    }
                }
            ]
        }, options);
    }

    this.set = async function(key, value, authorization, options) {
        authorization = authorization || this.defaultAuth
        options = { broadcast: true, sign: true, blocksBehind: 0, expireSeconds: 60, ...options }
        return this.eos.transact(
        {
            actions: [
                {
                    account: this.contract,
                    name: 'updatekey',
                    authorization,
                    data: {
                        owner: this.account_name,
                        key,
                        value
                    }
                }
            ]
        }, options);
    }

    this.rekey = async function(key, new_key, authorization, options) {
        authorization = authorization || this.defaultAuth
        options = { broadcast: true, sign: true, blocksBehind: 0, expireSeconds: 60, ...options }
        return this.eos.transact(
        {
            actions: [
                {
                    account: this.contract,
                    name: 'rekey',
                    authorization,
                    data: {
                        owner: this.account_name,
                        key,
                        new_key
                    }
                }
            ]
        }, options);
    }

    this.delete = async function(key, authorization, options) {
        authorization = authorization || this.defaultAuth
        options = { broadcast: true, sign: true, blocksBehind: 0, expireSeconds: 60, ...options }
        return this.eos.transact(
        {
            actions: [
                {
                    account: this.contract,
                    name: 'deletekey',
                    authorization,
                    data: {
                        owner: this.account_name,
                        key
                    }
                }
            ]
        }, options);
    }
}