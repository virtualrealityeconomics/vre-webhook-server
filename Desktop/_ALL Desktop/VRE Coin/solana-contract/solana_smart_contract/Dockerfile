# Use Node.js base image
FROM node:18

# Install Solana CLI and add to PATH
RUN curl -sSfL https://release.solana.com/v1.18.15/install | sh
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Verify Solana CLI installation and create symlinks
RUN ls -la /root/.local/share/solana/install/active_release/bin/ || echo "Directory not found"
RUN which spl-token || echo "spl-token not found in PATH"
RUN ln -sf /root/.local/share/solana/install/active_release/bin/spl-token /usr/local/bin/spl-token
RUN ln -sf /root/.local/share/solana/install/active_release/bin/solana /usr/local/bin/solana
RUN spl-token --version || echo "spl-token still not working"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]