const Putjs = require('../src/index.js')
const assert = require('assert');

const EOS_ENDPOINT = "http://localhost:8888"
const CONTRACTS_KEY_PRIV = "5JtUScZK2XEp3g9gh7F8bwtPTRAkASmNrrftmx4AxDKD5K4zDnr"

function debugResults(results) {
  for(let i = 0; i < results.length; i++) {
    console.log(`------ debug out ${i} ------`)
    console.log(results[i]);
    console.log(`--------------------------`)
  }
}

function newUtcDateString(addSeconds) {
  const now = new Date()
  now.setSeconds(now.getSeconds() + addSeconds)

  var n = now.toISOString()
  if (n.substr(23, 1) == 'Z') {
      n = n.substr(0, 23);
  }
  return n
}

describe('Put contract', () => {
    before(async function() {
        this.timeout(0);
    })

    after(async function() {
        this.timeout(0);
    })

    it('Insert key', async () => {
      const put1 = new Putjs({
        account_name: 'putuseruser1',
        eos_endpoint: EOS_ENDPOINT,
        account_payer_pk: CONTRACTS_KEY_PRIV
      });

      await put1.add('max_signups', '100');
      await put1.add('signup_uri', 'https://example.tld');

      const put2 = new Putjs({
        account_name: 'putuseruser2',
        eos_endpoint: EOS_ENDPOINT,
        account_payer_pk: CONTRACTS_KEY_PRIV
      });

      await put2.add('encrypted_hash', '4db268bbaad225a0a');
    })

    it('Update key', async () => {
      const put1 = new Putjs({
        account_name: 'putuseruser1',
        eos_endpoint: EOS_ENDPOINT,
        account_payer_pk: CONTRACTS_KEY_PRIV
      });

      await put1.set('max_signups', '200');
    })

    it('Rekey', async () => {
      const put1 = new Putjs({
        account_name: 'putuseruser1',
        eos_endpoint: EOS_ENDPOINT,
        account_payer_pk: CONTRACTS_KEY_PRIV
      });

      await put1.rekey('max_signups', 'max_signups2');
    })

    it('Delete key', async () => {
      const put1 = new Putjs({
        account_name: 'putuseruser1',
        eos_endpoint: EOS_ENDPOINT,
        account_payer_pk: CONTRACTS_KEY_PRIV
      });

      await put1.delete('max_signups2');
    })
  })
