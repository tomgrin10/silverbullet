FROM node:24.13.0-bookworm-slim@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f AS build
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN git init . && git remote add origin https://github.com/silverbulletmd/silverbullet.git \
    && git fetch --depth 1 origin 2b2a7c719bb3546df8c78ddeaf95256535ee2dd3 \
    && git checkout --detach FETCH_HEAD && rm -rf .git && npm ci --no-audit --no-fund
COPY text_direction.ts ./client/text_direction.ts
COPY bidi.ts bidi.test.ts ./client/codemirror/
COPY rtl.scss ./client/styles/rtl.scss
COPY fonts/ ./client/fonts/
COPY apply-patches.mjs ./
RUN node apply-patches.mjs && npm run build \
    && npm run check \
    && npx vitest run client/codemirror/bidi.test.ts client/codemirror/list_indent.test.ts client/codemirror/markdown_enter.test.ts client/markdown_renderer/markdown_render.test.ts

FROM nginx:1.28-alpine@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236
COPY --from=build /app/client_bundle/client/ /usr/share/nginx/html/
COPY --from=build /app/LICENSE.md /usr/share/nginx/html/.client/LICENSE.md
COPY nginx.conf /etc/nginx/nginx.conf
COPY proxy_params /etc/nginx/proxy_params
USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx", "-g", "daemon off;"]
