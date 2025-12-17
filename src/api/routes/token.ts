import _ from 'lodash';

import Request from '@/lib/request/Request.ts';
import Response from '@/lib/response/Response.ts';
import { getTokenLiveStatus, getCredit, tokenSplit } from '@/api/controllers/core.ts';
import { getStaticTokens, hasStaticTokens } from '@/lib/token-manager.ts';
import logger from '@/lib/logger.ts';

export default {

    prefix: '/token',

    post: {

        '/check': async (request: Request) => {
            request
                .validate('body.token', _.isString)
            const live = await getTokenLiveStatus(request.body.token);
            return {
                live
            }
        },

        '/points': async (request: Request) => {
            const tokens = hasStaticTokens()
                ? getStaticTokens()
                : tokenSplit(request.headers.authorization);
            if (!tokens.length) request.validate('headers.authorization', _.isString)
            const points = await Promise.all(tokens.map(async (token) => {
                return {
                    token,
                    points: await getCredit(token)
                }
            }))
            return points;
        }

    }

}
