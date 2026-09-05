FROM node:22-slim

WORKDIR /app
COPY package.json .
# @monaco-editor/react's published peer range doesn't yet list React 19,
# though it works fine at runtime — legacy-peer-deps skips the false conflict.
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
