# dataproof-js

## Getting Started 
**1. Install dataproof from `npm`.**
```
npm install dataproof
```
Or using `yarn`
```
yarn install dataproof
```

**2. Import dataproof lib into project.**
```
import dataproof from 'dataproof';
```
Or using require..
```
let dataproof = require('dataproof');
```

**3. Set which account's variables to access.**
```
let dp = new dataproof('ACCOUNT_NAME');
```

## API
**Return all matching variables from account.**
```
let all_data = dp.all();
```

**Get a specific variable from account.**
```
let single_item = dp.get('ITEM_NAME');
```
