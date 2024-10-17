# Dockerfile for frontend
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN npm run build

# Serve the application
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]

# Expose the port the app runs on
EXPOSE 5173
