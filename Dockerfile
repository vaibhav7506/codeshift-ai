FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json eslint.config.mjs ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci
RUN npm run build --workspace=@codeshift/web

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd --system codeshift && useradd --system --gid codeshift codeshift
COPY --from=build --chown=codeshift:codeshift /app/apps/web/.next/standalone ./
COPY --from=build --chown=codeshift:codeshift /app/apps/web/.next/static ./apps/web/.next/static
USER codeshift
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
