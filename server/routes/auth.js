const _ = require('lodash');
const express = require('express');
const router = express.Router();
// const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Room = require('../models/Room');
const gravatar = require('gravatar');
// const socialAuthActions = require('../actions/socialAuthActions');
const bcrypt = require('bcryptjs');
var nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const Sequelize = require('sequelize');

/** Middleware */
const {
	checkRegistrationFields,
	checkLoginFields,
	createErrorObject,
	// customSocialAuthenticate
	checkForgotFields,
} = require('../middleware/authenticate');

/**
 * @description  POST /register
 * @param  {} [checkRegistrationFields]
 * @param  {} request
 * @param  {} response
 * @access public
 */
router.post('/register', [checkRegistrationFields], (req, res) => {
	let errors = [];

	User.findOne({
		where: {
			email: req.body.email,
		},
	}).then(user => {
		if (user) {
			errors.push({
				param: 'email',
				msg: 'Email is already taken',
			});

			if (user.username === req.body.username) {
				errors.push({
					param: 'username',
					msg: 'Username is already taken',
				});
			}

			res
				.send({
					errors: createErrorObject(errors),
				})
				.end();
		} else {
			/** Assign Gravatar */
			const avatar = gravatar.url(req.body.email, {
				s: '220',
				r: 'pg',
				d: 'identicon',
			});

			bcrypt
				.hash(req.body.password, 10)
				.then(hash => {
					req.body.password = hash;

					const newUser = new User({
						handle: req.body.handle,
						username: req.body.username,
						email: req.body.email,
						password: req.body.password,
						image: avatar,
						status_active: 1,
					});

					newUser.save().then(userData => {
						const user = _.omit(userData.dataValues, ['password']);

						const token = jwt.sign(user, process.env.JWT_SECRET, {
							expiresIn: 18000,
						});

						res.status(200).send({
							auth: true,
							token: `Bearer ${token}`,
							user,
						});
					});
				})
				.catch(err => {
					console.log('err', err);
					res.send({
						err,
						error: 'Something went wrong, Please check the fields again',
					});
				});
		}
	});
});

/**
 * @description POST /login
 * @param  {} checkLoginFields
 * @param  {} request
 * @param  {} response
 * @access public
 */
router.post('/login', checkLoginFields, async (req, res) => {
	const user = await User.findOne({
		where: Sequelize.or(
			{
				email: req.body.email,
			},
			{
				username: req.body.email,
			},
		),
		raw: true,
	});

	if (!user) {
		return res.status(404).send({
			error: 'No User Found',
		});
	}
	const token = jwt.sign(user, process.env.JWT_SECRET, {
		expiresIn: 18000,
	});

	await User.update(
		{
			status_active: 1,
		},
		{
			where: Sequelize.or(
				{
					email: req.body.email,
				},
				{
					username: req.body.email,
				},
			),
			raw: true,
		},
	);

	res.status(200).send({
		auth: true,
		token: `Bearer ${token}`,
		user,
	});
});

router.post('/logout', async (req, res) => {
	await User.update(
		{
			status_active: 0,
		},
		{
			where: {
				id: req.body.id,
			},
			raw: true,
		},
	);

	res.status(200).send({});
});

router.post('/forgot', checkForgotFields, async (req, res) => {
	const user = await User.findOne({
		where: {
			email: req.body.email,
		},
		raw: true,
	});

	if (!user) {
		return res.status(404).send({
			error: 'No User Found',
		});
	}
	let token = jwt.sign(user, process.env.JWT_SECRET, {
		expiresIn: 18000,
	});

	token = `Bearer ${token}`;

	var transport = nodemailer.createTransport({
		host: process.env.mailServerhost,
		port: process.env.mailServerport,
		auth: {
			user: process.env.mailServeruser, //generated by Mailtrap
			pass: process.env.mailServerpass, //generated by Mailtrap
		},
	});
	transport.verify(function(error, success) {
		if (error) {
			return res.status(400).send('mailtrap authorization failed ' + error);
		} else {
			console.log('Server is ready to take our messages');
		}
	});
	var mailOptions = {
		from: '"Example Team" <from@example.com>',
		to: process.env.myEmailAddress,
		subject: 'Forgot Password',
		text: 'Hello' + req.body.email,
		token: `Bearer ${token}`,
		html: `<b>Hey there! </b><br><a href="${req.get(
			'origin',
		)}/resetpassword/${token}">Please click this link</a>`,
	};
	transport.sendMail(mailOptions, (error, info) => {
		if (error) {
			return res.send({
				error,
				error: 'Something went wrong, Please check the fields again',
			});
		}
		return res.send({
			error: 'Mail Sent Successful',
		});
	});
	// sgMail.setApiKey(process.env.SENDGRID_API_KEY);
	// token = encodeURI(token);
	// const msg = {
	//     to: process.env.myEmailAddress,
	//     from: 'test@example.com',
	//     subject: 'Sending with SendGrid is Fun',
	//     text: 'and easy to do anywhere, even with Node.js',
	//      html: `<b>Hey there! </b><br><a href="${req.get('origin')}/resetpassword/${token}">Please click this link</a>`
	// };

	// sgMail.send(msg, (error, info) => {
	//     if (error) {
	//         return res.status(400).send('Cannot send email via sendgrid ' + error)
	//     }
	//     console.log('Sendgrid Message sent: %s', info);
	//     return res.send('Email sent successfully')
	// });
});

/**
 * @description POST /logout
 * @param  {} request
 * @param  {} response
 * @access public
 */
// router.post('/logout', async (req, res) => {
//     const user = await User.findOne({ username: req.body.username }).select('-password');

//     if (!user) {
//         return res.status(404).send({
//             error: 'No User Found'
//         });
//     }

//     res.status(200).send({ success: true });
// });

/** Social Auth Routes */
// router.get('/google', customSocialAuthenticate('google'));
// router.get('/facebook', customSocialAuthenticate('facebook'));

// /** Social Auth Callbacks */
// router.get('/google/redirect', passport.authenticate('google'), socialAuthActions.google);
// router.get('/facebook/redirect', passport.authenticate('facebook'), socialAuthActions.facebook);

module.exports = router;
