const redis = require('redis');

class RedisService {
  constructor() {
    this.client = null;
  }

  async connect() {
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      await this.client.connect();
      console.log('🔴 Redis connected successfully');
    } catch (error) {
      console.error('❌ Redis connection error:', error.message);
      // Don't throw error in production or test environments, just log it
      if (process.env.NODE_ENV === 'development' && process.env.NODE_ENV !== 'test') {
        throw error;
      }
      // In test environment, set client to null to indicate Redis is not available
      this.client = null;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      console.log('🔴 Redis disconnected');
    }
  }

  async blacklistToken(token, expiresIn = 7 * 24 * 60 * 60) { // 7 days default
    try {
      if (!this.client) return;
      await this.client.setEx(`blacklist:${token}`, expiresIn, 'true');
    } catch (error) {
      console.error('Error blacklisting token:', error);
    }
  }

  async isTokenBlacklisted(token) {
    try {
      if (!this.client) return false;
      const result = await this.client.get(`blacklist:${token}`);
      return result === 'true';
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      return false;
    }
  }

  async clearBlacklist(token) {
    try {
      if (!this.client) return;
      await this.client.del(`blacklist:${token}`);
    } catch (error) {
      console.error('Error clearing token from blacklist:', error);
    }
  }
}

module.exports = new RedisService();
