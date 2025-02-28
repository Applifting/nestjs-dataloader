# NestJS Dataloader

![Node.js CI](https://github.com/Applifting/nestjs-dataloader/workflows/Node.js%20CI/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/Applifting/nestjs-dataloader/badge.svg?branch=master)](https://coveralls.io/github/krislefeber/nestjs-dataloader?branch=master)

NestJS dataloader simplifies adding [graphql/dataloader](https://github.com/graphql/dataloader) to your NestJS project. DataLoader aims to solve the common N+1 loading problem.

This is a fork of krislefeber/nestjs-dataloader with the following changes:

- Replace generateDataLoader method in interface with getBatchFunction, reducing the need to import anything from the dataloader package and simplifying the code
- Added `sortDataLoaderResultsByKey` convenience method, since some batching methods you can use (like `SELECT * IN (...)`) do not guarantee the order of the returned results to match the order of provided keys, which is essential for dataloader to work properly
- Updated all dependencies to latest versions

## Installation

```bash
npm i @applifting-io/nestjs-dataloader
```

## Usage

### NestDataLoader Creation

We start by implementing the `NestDataLoader` interface. This tells `DataLoader` how to load our objects.

```typescript
import { Injectable } from '@nestjs/common';
import { NestDataLoader, DataLoaderBatchFunction } from '@applifting-io/nestjs-dataloader';
...

@Injectable()
export class AccountLoader implements NestDataLoader<string, Account> {
  constructor(private readonly accountService: AccountService) { }

  getBatchFunction(): DataLoaderBatchFunction<string, Account> {
    return (keys: string[]) => {
      const results = await this.accountService.findByIds(keys);
      return sortDataLoaderResultsByKey(keys, results, "id");
    };
  }
}
```

The first generic of the interface is the type of ID the datastore uses. The second generic is the type of object that will be returned. In the above instance, we want `DataLoader` to return instances of the `Account` class.

### Providing the NestDataLoader

For each NestDataLoader we create, we need to provide it to our module.

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DataLoaderInterceptor } from 'nestjs-dataloader'
...

@Module({
  providers: [
    AccountResolver,
    AccountLoader,
    {
      provide: APP_INTERCEPTOR,
      useClass: DataLoaderInterceptor,
    },
  ],

})
export class ResolversModule { }
```

### Using the NestDataLoader

Now that we have a dataloader and our module is aware of it, we need to pass it as a parameter to an endpoint in our graphQL resolver.

```typescript
import * as DataLoader from 'dataloader';
import { Loader } from 'nestjs-dataloader';
...

@Resolver(Account)
export class AccountResolver {

    @Query(() => [Account])
    public getAccounts(
        @Args({ name: 'ids', type: () => [String] }) ids: string[],
        @Loader(AccountLoader) accountLoader: DataLoader<Account['id'], Account>): Promise<Account[]> {
        return accountLoader.loadMany(ids);
    }
}
```

The important thing to note is that the parameter of the `@Loader` decorator is the entity/class of the `NestDataLoader` we want to be injected to the method. The DataLoader library will handle bulk retrieval and caching of our requests. Note that the caching is stored on a per-request basis.

## Contributing

Pull requests are always welcome. For major changes, please open an issue first to discuss what you would like to change.
