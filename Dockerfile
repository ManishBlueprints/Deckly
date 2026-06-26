# Dockerfile for local development
FROM node:24-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose Vite's default port
EXPOSE 5173

# Run development server with host flag to allow Docker network access
CMD ["npm", "run", "dev", "--", "--host"]
