// scripts/create-admin.js
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)

  const emailArg = args.find(a => a.startsWith('--email='))?.split('=')[1]
  const nameArg = args.find(a => a.startsWith('--name='))?.split('=')[1]
  const passwordArg = args.find(a => a.startsWith('--password='))?.split('=')[1]
  const tenantSlugArg = args.find(a => a.startsWith('--tenant='))?.split('=')[1] || 'default'

  if (!emailArg) {
    console.error('❌ Tens de indicar --email=')
    process.exit(1)
  }

  const name = nameArg || 'Admin'
  const email = emailArg
  const rawPassword = passwordArg || crypto.randomBytes(8).toString('hex')

  // 1️⃣ Criar ou reutilizar Tenant
  let tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlugArg }
  })

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug: tenantSlugArg,
        name: tenantSlugArg
      }
    })
    console.log(`✅ Tenant criado: ${tenant.slug}`)
  } else {
    console.log(`ℹ️ Tenant reutilizado: ${tenant.slug}`)
  }

  // 2️⃣ Verificar se já existe user
  const existingUser = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email
      }
    }
  })

  if (existingUser) {
    console.log('⚠️ Já existe um utilizador com este email neste tenant.')
    process.exit(0)
  }

  // 3️⃣ Gerar hash
  const passwordHash = await bcrypt.hash(rawPassword, 10)

  // 4️⃣ Criar Admin
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name,
      email,
      passwordHash,
      role: 'ADMIN',
      isActive: true
    }
  })

  console.log('🎉 Admin criado com sucesso!')
  console.log('-----------------------------------')
  console.log('Email:', admin.email)
  console.log('Password:', rawPassword)
  console.log('Tenant:', tenant.slug)
  console.log('-----------------------------------')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
