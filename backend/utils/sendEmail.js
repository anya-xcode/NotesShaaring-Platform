const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const sendEmail = async ({ to, subject, html }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Notes Platform <onboarding@resend.dev>',
      to,
      subject,
      html,
    });

    if (error) {
      console.error('❌ Resend Email Error:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error('❌ Email send failed:', err);
    return { success: false, error: err };
  }
};

module.exports = sendEmail; 
