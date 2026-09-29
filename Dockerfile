FROM mcr.microsoft.com/playwright:v1.49.0
WORKDIR /app
COPY package*.json ./
RUN npm install
# package.json uses ^1.49, so fetch the browser build that matches the installed version
RUN npx playwright install chromium
COPY . .
EXPOSE 5173
CMD ["npx", "tsx", "src/server.ts"]
