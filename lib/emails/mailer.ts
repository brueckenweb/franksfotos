import nodemailer from "nodemailer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mailer = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "server.brueckenweb.de",
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: Number(process.env.EMAIL_PORT) === 465,
  authMethod: "LOGIN", // Erzwingt AUTH LOGIN statt AUTH PLAIN
  auth: {
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASS || "",
  },
  tls: {
    rejectUnauthorized: false,
  },
} as Parameters<typeof nodemailer.createTransport>[0]);
