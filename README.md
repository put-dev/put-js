# put-js

## Getting Started 
**1. Install putjs from `npm`.**
```
npm install putjs
```
Or using `yarn`
```
yarn install putjs
```

**2. Import putjs lib into project.**
```
import putjs from 'putjs';
```
Or using require..
```
let putjs = require('putjs');
```

**3. Set which account's variables to access (and api to use).**
```
let dp = new putjs('ACCOUNT_NAME', 'https://eos.greymass.com');
```
Or with, optional, in depth configuration..
```
let dp = new putjs({
account_name: 'ACCOUNT_NAME', // required
eos_network: 'https://eos.greymass.com', // required
account_payer_pk: '5JztX3HYkr9V4J5SXtChLwvjgzvTVCYLcWwEqEqUyAPoZozAbUy', // defaults to empty string (optional)
account_payer_permission: 'owner' // defaults to active. (optional)
});
```

## API
**Return all matching variables from account.**
```
let all_data = await dp.all();
=> all_data: {
project_name: "some_string",
max_points: "10"
}
```

**Get a specific variable from account.**
```
let single_item = await dp.get('ITEM_NAME');
=> single_item: "my_string_value"
```

**Add a new variable to account.**
=> Available when `account_payer_pk` is set.
```
let add_item = await dp.add('NEW_ITEM_NAME','NEW_ITEM_VALUE');
=> add_item: what should return???
```

**Update a variable from account.**
=> Available when `account_payer_pk` is set.
```
let update_item = await dp.set('EXISTING_ITEM_NAME','NEW_ITEM_VALUE');
=> update_item: what should return???
```

**Changes a existing `key` name.**
=> Available when `account_payer_pk` is set.
```
let rekey_item = await dp.rekey('EXISTING_ITEM_KEY','NEW_ITEM_KEY');
=> rekey_item: what should return???
```

**Deletes an existing key/value pair.**
=> Available when `account_payer_pk` is set.
```
let delete_item = await dp.delete('EXISTING_ITEM_KEY');
=> delete_item: what should return???
```
