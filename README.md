# grapqhl-fragment-import ![CI](https://github.com/stefanpenner/grapqhl-fragment-import/workflows/CI/badge.svg)

NOTE: Module is WIP, it is not yet released, and subject to change.

This node_module is two things:

* an executable to perform graphql module importing
* a library to reuse the underlying code in other libraries programmatically (linting, build tools etc)


# Import syntax


```graphql

#import "./_my-fragment.graphql"
#import './_my-other-fragment.graphql'
#import "some-node-module/_its-fragment.graphql"
```


# Usage (as an executable)
```sh

npx graphql-fragment-import <file>
npx graphql-fragment-import <file> -o <output-file>
npx graphql-fragment-import <directory> -d <output-directory>
```

# Usage (as a library)


```sh
yarn add graphql-fragment-import
```

or

```sh
npm add --save graphql-fragment-import
```

```js
'use strict';

const fragmentImport = require('graphql-fragment-import');

const output = fragmentImport(fileContents, {
  basedir /* required: specifies where to start resolving imported fragments from */,
  resolve /* optional: allows the caller to provide an alternative resolution algorithm */,
  fs /* optiona: allows for the caller to provide an alternative implementation of node's fs module */
});

output; // contains the grapqhl file, with all imports having been inlined
```

# Example importable fragments

Given the following files

```graphql
# // file: _my-fragment.graphql

fragment MyFragment {
  fieldC
}
```

```graphql
# // file: my-query.graphql
#import './_my-fragment.graphql'

query {
  myQuery {
    fieldA,
    fieldB
    ...MyFragment
  }
}
```

results in:

```sh
npx graphql-fragment-import ./my-query.graphql
> fragment MyFragment {
>   fieldC
> }
>
> query {
>   myQuery {
>     filedA,
>     fieldB,
>     ...MyFragment
>   }
> }
```
alternatively, we can provide an input dir and output dir, and let the tool convert many files at once:

```js
npx graphql-fragment-import ./ -d ./output/
>   [processed] my-query.graphql -> ${pwd}/output//my-query.graphql
```
