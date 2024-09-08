const SmeeClient = require('smee-client')

const smee = new SmeeClient({
  source: 'https://smee.io/G33dBntdhg6I4Kb',
  target: 'http://localhost:3000/webhook',
  logger: console
})

smee.start()