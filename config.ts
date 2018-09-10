import * as Logger from 'bunyan';
import { uri_to_config } from 'nodejs-utils';
import { IormMwConfig, IOrmsOut, RequestHandler } from 'orm-mw';
import { Server } from 'restify';
import { IRoutesMergerConfig } from 'routes-merger';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

/* TODO: Put this all in tiered environment-variable powered .json file */

export const db_uri: string = process.env['RDBMS_URI'] || process.env['DATABASE_URL'] || process.env['POSTGRES_URL'];

if (db_uri == null || !db_uri.length)
    throw ReferenceError('Database URI not set. See README.md for setup tutorial.');

export const typeorm_config: PostgresConnectionOptions = Object.freeze(
    Object.assign(Object.entries(uri_to_config(db_uri))
            .map((kv: [string, any]) => ({ [kv[0] === 'user' ? 'username' : kv[0]]: kv[1] }))
            .reduce((a, b) => Object.assign(a, b), {}),
        {
            type: 'postgres',
            autoSchemaSync: true,
            synchronize: true,
            logging: { logQueries: true }
        }
    ) as any as PostgresConnectionOptions
);

// ONLY USE `_orms_out` FOR TESTS!
export const _orms_out: {orms_out: IOrmsOut} = { orms_out: undefined };

export const getOrmMwConfig = (models: Map<string, any>, logger: Logger,
                               cb: (err: Error,
                                    with_app?: IRoutesMergerConfig['with_app'],
                                    orms_out?: IOrmsOut) => void): IormMwConfig => ({
    models, logger,
    orms_in: {
        redis: {
            skip: false,
            config: {
                port: parseInt(process.env.REDIS_PORT || 6379 as any, 10),
                host: process.env.REDIS_HOST || 'localhost'
            }
        },
        sequelize: {
            skip: true
        },
        typeorm: {
            skip: false,
            config: typeorm_config
        },
        waterline: {
            skip: true
        }
    },
    callback: (e: Error, mw: RequestHandler, orms_out: IOrmsOut) => {
        if (e != null) {
            if (cb != null) return cb(e);
            throw e;
        }
        _orms_out.orms_out = orms_out;
        return cb(void 0, (_app: Server) => {
            _app.use(mw);
            return _app;
        }, orms_out);
    }
});
