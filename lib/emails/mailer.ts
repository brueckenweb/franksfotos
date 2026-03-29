import nodemailer from "nodemailer";

export const mailer = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "server.brueckenweb.de",
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});
