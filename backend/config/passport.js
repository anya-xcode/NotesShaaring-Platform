const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = function () {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const state = req.query.state || 'login';
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(null, false, { message: 'Email not found in Google profile.' });
          }
          let user = await User.findOne({ email });
          if (state === 'signup') {
            if (!user) {
              const generatedUsername =
                profile.displayName.toLowerCase().replace(/\s+/g, '') + Date.now();
              user = await User.create({
                googleId: profile.id,
                name: profile.displayName,
                email,
                username: generatedUsername, 
              });
              user._alreadyExists = false;
            } else {
              user._alreadyExists = true;
            }
          } else {
            if (!user) {
              return done(null, false, {
                message: 'No account found. Please sign up first.',
              });
            }
            if (!user.googleId) {
              user.googleId = profile.id;
              user.name = user.name || profile.displayName;
              await user.save();
            }
          }
          return done(null, user);
        } catch (err) {
          console.error('Google OAuth Error:', err);
          return done(err, null);
        }
      }
    )
  );
};
