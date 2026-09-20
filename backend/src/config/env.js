import dotenv from 'dotenv';

dotenv.config();

const requiredVars = [
    'JWT_SECRET',
    'GROQ_API_KEY',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'PORT'
];

for (const varName of requiredVars) {
    if (!process.env[varName]) {
        throw new Error(`Environment variable ${varName} is missing`);
    }
}

const env = Object.freeze({
    JWT_SECRET: process.env.JWT_SECRET,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    PORT: process.env.PORT,
    DB_PORT: process.env.DB_PORT,
    FRONTEND_URL: process.env.FRONTEND_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    JWT_EXPIRES: process.env.JWT_EXPIRES
});

export default env;
