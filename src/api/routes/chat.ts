import _ from 'lodash';

import Request from '@/lib/request/Request.ts';
import Response from '@/lib/response/Response.ts';
import { acquireRequestToken } from "@/lib/token-manager.ts";
import { createCompletion, createCompletionStream } from '@/api/controllers/chat.ts';

export default {

    prefix: '/v1/chat',

    post: {

        '/completions': async (request: Request) => {
            request
                .validate('body.model', v => _.isUndefined(v) || _.isString(v))
                .validate('body.messages', _.isArray)
            const { token, release } = await acquireRequestToken(request);
            const { model, messages, stream } = request.body;
            if (stream) {
                const streamBody = await createCompletionStream(messages, token, model);
                const cleanup = _.once(release);
                streamBody.on("end", cleanup);
                streamBody.on("close", cleanup);
                streamBody.on("error", cleanup);
                return new Response(streamBody, {
                    type: "text/event-stream"
                });
            }
            else {
                try {
                    return await createCompletion(messages, token, model);
                } finally {
                    release();
                }
            }
        }

    }

}
