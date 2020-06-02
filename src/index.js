const isNode =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

const { Api, JsonRpc } = require("eosjs");
const { JsSignatureProvider } = require("eosjs/dist/eosjs-jssig");
const eosECC = require("eosjs-ecc");

let fetch;
if (isNode) {
  fetch = require("node-fetch");
  const util = require("util");
  TextDecoder = util.TextDecoder;
  TextEncoder = util.TextEncoder;
}

module.exports = function ({
  account_name, // required
  eos_endpoint, // required
  contract = "putinventory", // defaults to 'putinventory' string (optional)
  account_payer_pk = "", // defaults to empty string (optional)
  account_payer_permission = "active", // defaults to active. (optional)
}) {
  this.account_name = account_name;
  this.eos_endpoint = eos_endpoint;
  this.contract = contract;
  this.account_payer_pk = account_payer_pk;
  this.account_payer_permission = account_payer_permission;
  this.defaultAuth = [
    { actor: this.account_name, permission: this.account_payer_permission },
  ];
  this.fixedRowRamCost = 284;

  this.rpc = new JsonRpc(eos_endpoint, isNode ? { fetch } : {});

  if (this.account_payer_pk) {
    this.eos = new Api({
      rpc: this.rpc,
      signatureProvider: new JsSignatureProvider([this.account_payer_pk]),
      textEncoder: new TextEncoder(),
      textDecoder: new TextDecoder(),
    });
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

  this.account = function () {
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

  this.all = async function () {
    let result = [],
      data;

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

  this.get = async function (key, binId = 0) {
    if (!key) {
      throw new Error("key required.");
    }

    const hash = eosECC.sha256(binId + "-" + key);
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

  this.add = async function (key, value, binId = 0, authorization, options) {
    if (!this.eos) {
      throw new Error("Api not authenticated. provide private key.");
    }

    authorization = authorization || this.defaultAuth;
    options = {
      broadcast: true,
      sign: true,
      blocksBehind: 0,
      expireSeconds: 60,
      ...options,
    };
    return this.eos.transact(
      {
        actions: [
          {
            account: this.contract,
            name: "insertkey",
            authorization,
            data: {
              owner: this.account_name,
              bin_id: binId,
              key,
              value,
            },
          },
        ],
      },
      options
    );
  };

  this.set = async function (key, value, binId = 0, authorization, options) {
    if (!this.eos) {
      throw new Error("Api not authenticated. provide private key.");
    }

    authorization = authorization || this.defaultAuth;
    options = {
      broadcast: true,
      sign: true,
      blocksBehind: 0,
      expireSeconds: 60,
      ...options,
    };
    return this.eos.transact(
      {
        actions: [
          {
            account: this.contract,
            name: "updatekey",
            authorization,
            data: {
              owner: this.account_name,
              bin_id: binId,
              key,
              value,
            },
          },
        ],
      },
      options
    );
  };

  this.rekey = async function (
    key,
    new_key,
    binId = 0,
    authorization,
    options
  ) {
    if (!this.eos) {
      throw new Error("Api not authenticated. provide private key.");
    }

    authorization = authorization || this.defaultAuth;
    options = {
      broadcast: true,
      sign: true,
      blocksBehind: 0,
      expireSeconds: 60,
      ...options,
    };
    return this.eos.transact(
      {
        actions: [
          {
            account: this.contract,
            name: "rekey",
            authorization,
            data: {
              owner: this.account_name,
              bin_id: binId,
              key,
              new_key,
            },
          },
        ],
      },
      options
    );
  };

  this.delete = async function (key, binId = 0, authorization, options) {
    if (!this.eos) {
      throw new Error("Api not authenticated. provide private key.");
    }

    authorization = authorization || this.defaultAuth;
    options = {
      broadcast: true,
      sign: true,
      blocksBehind: 0,
      expireSeconds: 60,
      ...options,
    };
    return this.eos.transact(
      {
        actions: [
          {
            account: this.contract,
            name: "deletekey",
            authorization,
            data: {
              owner: this.account_name,
              bin_id: binId,
              key,
            },
          },
        ],
      },
      options
    );
  };

  // estimators (returns bytes needed)
  const thisRoot = this;
  this.estimate = {
    add: function (key, value) {
      return thisRoot.fixedRowRamCost + key.length + value.length;
    },

    set: async function (key, value, binId = 0) {
      const oldVal = await thisRoot.get(key, binId);
      return key - oldVal.key + value - oldVal.value;
    },

    rekey: async function (key, new_key, binId = 0) {
      const oldVal = await thisRoot.get(key, binId);
      return new_key - oldVal.key;
    },

    delete: async function (key, binId = 0) {
      const oldVal = await thisRoot.get(key, binId);
      return -(thisRoot.fixedRowRamCost + oldVal.key + oldVal.value);
    },
  };
};
