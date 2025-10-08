const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Parse form data
    const formData = new URLSearchParams(event.body);
    const email = formData.get("email");
    const botField = formData.get("bot-field");

    // Check for spam (honeypot)
    if (botField) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Spam detected" }),
      };
    }

    // Validate email
    if (!email || !email.includes("@")) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Valid email required" }),
      };
    }

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 800 });

    // Navigate to your site (use the Netlify URL)
    const siteUrl =
      process.env.URL || "https://maru-online.github.io/digivation-profile/";
    await page.goto(siteUrl, { waitUntil: "networkidle0" });

    // Wait for fonts and images to load
    await page.waitForTimeout(2000);

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "10mm",
        right: "10mm",
        bottom: "10mm",
        left: "10mm",
      },
    });

    await browser.close();

    // Send email with PDF attachment
    const transporter = nodemailer.createTransporter({
      service: "gmail", // or your preferred email service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Digivation (Pty) Ltd" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Digivation Company Profile - PDF",
      html: `
        <h2>Thank you for your interest in Digivation!</h2>
        <p>Please find attached the Digivation Company Profile PDF.</p>
        <p>If you have any questions or would like to discuss our services, please don't hesitate to contact us:</p>
        <ul>
          <li>Email: info@digivation.global</li>
          <li>Website: www.digivation.global</li>
          <li>Phone: [Your phone number]</li>
        </ul>
        <p>Best regards,<br>The Digivation Team</p>
      `,
      attachments: [
        {
          filename: "Digivation-Company-Profile.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "PDF sent successfully",
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
    };
  }
};
