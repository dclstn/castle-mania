import Stripe from 'stripe';
import dotenv from 'dotenv';
import App from '../../server.js';
import {PaymentIds} from '../../constants.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_KEY, {apiVersion: '2020-08-27'});

// @ts-ignore
App.get('/create-checkout-session', {preValidation: [App.authenticate]}, async (request, response) => {
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price: PaymentIds.GIFTS.FIVE,
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: 'http://localhost:8000/success',
    cancel_url: 'http://localhost:8000/cancel',
  });

  response.redirect(303, session.url);
});

App.register((fastify, opts, done) => {
  fastify.addContentTypeParser('application/json', {parseAs: 'buffer'}, (req, body, next) => {
    try {
      const newBody = {raw: body};
      next(null, newBody);
    } catch (error) {
      error.statusCode = 400;
      next(error, undefined);
    }
  });

  fastify.post('/webhook', (request, response) => {
    const sig = request.headers['stripe-signature'];

    let event: Stripe.Event;

    try {
      // @ts-ignore type parser above adds this field.
      event = stripe.webhooks.constructEvent(request.body.raw, sig, process.env.PAYMENT_ENDPOINT);
    } catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log(paymentIntent);
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    response.send();
  });

  done();
});