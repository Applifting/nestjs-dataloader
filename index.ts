import {
  CallHandler,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
  Type,
} from "@nestjs/common";
import { APP_INTERCEPTOR, ModuleRef, ContextIdFactory } from "@nestjs/core";
import { GqlExecutionContext } from "@nestjs/graphql";
import DataLoader from "dataloader";
import { Observable } from "rxjs";

/**
 * This interface will be used to generate the initial data loader.
 * The concrete implementation should be added as a provider to your module.
 */
export interface NestDataLoader<ID, Type> {
  /**
   * Should return a new instance of dataloader each time
   */
  getBatchFunction(): (keys: ID[]) => PromiseLike<Type[]>;
}

/**
 * Context key where get loader function will be stored.
 * This class should be added to your module providers like so:
 * {
 *     provide: APP_INTERCEPTOR,
 *     useClass: DataLoaderInterceptor,
 * },
 */
const NEST_LOADER_CONTEXT_KEY: string = "NEST_LOADER_CONTEXT_KEY";

@Injectable()
export class DataLoaderInterceptor implements NestInterceptor {
  constructor(private readonly moduleRef: ModuleRef) {}
  /**
   * @inheritdoc
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const graphqlExecutionContext = GqlExecutionContext.create(context);
    const ctx = graphqlExecutionContext.getContext();

    if (ctx[NEST_LOADER_CONTEXT_KEY] === undefined) {
      ctx[NEST_LOADER_CONTEXT_KEY] = {
        contextId: ContextIdFactory.create(),
        getLoader: (type: string): Promise<NestDataLoader<any, any>> => {
          if (ctx[type] === undefined) {
            try {
              ctx[type] = (async () => {
                const dataLoaderImplementation = await this.moduleRef.resolve<
                  NestDataLoader<any, any>
                >(type, ctx[NEST_LOADER_CONTEXT_KEY].contextId, {
                  strict: false,
                });
                return new DataLoader(
                  dataLoaderImplementation.getBatchFunction()
                );
              })();
            } catch (e) {
              throw new InternalServerErrorException(
                `The loader ${type} is not provided` + e
              );
            }
          }
          return ctx[type];
        },
      };
    }
    return next.handle();
  }
}

/**
 * The decorator to be used within your graphql method.
 */
export const Loader = createParamDecorator(
  async (
    data: Type<NestDataLoader<any, any>>,
    context: ExecutionContext & { [key: string]: any }
  ) => {
    const ctx: any = GqlExecutionContext.create(context).getContext();
    if (ctx[NEST_LOADER_CONTEXT_KEY] === undefined) {
      throw new InternalServerErrorException(`
            You should provide interceptor ${DataLoaderInterceptor.name} globally with ${APP_INTERCEPTOR}
          `);
    }
    return await ctx[NEST_LOADER_CONTEXT_KEY].getLoader(data);
  }
);

/**
 * Utility function that sorts the results of the data loader by the key so that it's always in the correct order.
 */
export const sortDataLoaderResultsByKey = <
  T extends Record<string | number | symbol, any>
>(
  keys: string[],
  items: T[],
  key: keyof T
): T[] => {
  const keyToItemMap = new Map<string, T>();
  items.forEach((item) => keyToItemMap.set(item[key], item));
  return keys.map((id) => keyToItemMap.get(id)).sort((a, b) => a[key] - b[key]);
};
