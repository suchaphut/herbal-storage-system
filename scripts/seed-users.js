// Seed script to create demo users with proper bcrypt passwords
// Run with: node scripts/seed-users.js

const bcrypt = require('bcryptjs')

async function generateHashes() {
  const users = [
    { email: 'admin@herbal.local', password: 'admin123', role: 'admin' },
    { email: 'operator@herbal.local', password: 'operator123', role: 'operator' },
    { email: 'viewer@herbal.local', password: 'viewer123', role: 'viewer' },
  ]

  console.log('Generating bcrypt hashes for demo users:\n')

  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 10)
    console.log(`${user.role.toUpperCase()}:`)
    console.log(`  Email: ${user.email}`)
    console.log(`  Password: ${user.password}`)
    console.log(`  Hash: ${hash}`)
    console.log('')
  }

  console.log('\nYou can use these hashes in mock-db.ts for testing.')
  console.log('Or connect to MongoDB and insert these users using the API.')
}

generateHashes().catch(console.error)
