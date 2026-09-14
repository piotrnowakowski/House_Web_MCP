FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY dist-server/ ./
USER node
EXPOSE 8081
HEALTHCHECK --interval=20s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8081/api/sync/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "main.mjs"]
