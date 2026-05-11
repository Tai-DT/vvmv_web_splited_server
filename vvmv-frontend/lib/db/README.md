# Database Connections

This directory contains database connection utilities for 3 separate SQL Server databases.

## Architecture

### 1. RPA Database (Prisma ORM)
- **Purpose**: Main application database for new features and tables
- **Technology**: Prisma ORM (fully typed, schema-driven)
- **Connection**: [lib/db/rpa.ts](./rpa.ts)
- **Schema**: [prisma/schema.prisma](../../prisma/schema.prisma)

### 2. ERP HCM Database (Raw SQL)
- **Purpose**: Existing ERP system database (Ho Chi Minh)
- **Technology**: `mssql` driver with raw SQL queries
- **Connection**: [lib/db/erp-hcm.ts](./erp-hcm.ts)

### 3. ERP HN Database (Raw SQL)
- **Purpose**: Existing ERP system database (Hanoi)
- **Technology**: `mssql` driver with raw SQL queries
- **Connection**: [lib/db/erp-hn.ts](./erp-hn.ts)

## Usage Examples

### RPA Database (Prisma)

```typescript
import { prismaRPA } from '@/lib/db';

// Define your models in prisma/schema.prisma first

// Find all users
const users = await prismaRPA.user.findMany();

// Find customer by tax code
const customer = await prismaRPA.customer.findUnique({
  where: { taxCode: '3700482964' }
});

// Create new employee
const employee = await prismaRPA.employee.create({
  data: {
    email: 'john@vvmv.com.vn',
    name: 'John Doe',
    role: 'user'
  }
});
```

### ERP HCM Database (Raw SQL)

```typescript
import { queryERPHCM } from '@/lib/db';

// Query with parameters
const orders = await queryERPHCM<Order>(
  'SELECT * FROM Orders WHERE CustomerId = @customerId AND Status = @status',
  { customerId: 123, status: 'Active' }
);

// Access results
console.log(orders.recordset); // Array of records
console.log(orders.rowsAffected); // Number of affected rows
```

### ERP HN Database (Raw SQL)

```typescript
import { queryERPHN } from '@/lib/db';

// Query products
const products = await queryERPHN<Product>(
  'SELECT TOP 10 * FROM Products WHERE Active = @active ORDER BY CreatedDate DESC',
  { active: true }
);

console.log(products.recordset); // Array of products
```

## Environment Variables

Make sure these are set in your `.env.local`:

```env
# RPA Database (Prisma format)
RPA_DATABASE_URL="sqlserver://server;database=RPA;user=username;password=pass;encrypt=false"

# ERP HCM Database
ERP_HCM_DB_SERVER=server
ERP_HCM_DB_NAME=database
ERP_HCM_DB_USER=username
ERP_HCM_DB_PASSWORD=password
ERP_HCM_DB_ENCRYPT=false

# ERP HN Database
ERP_HN_DB_SERVER=server
ERP_HN_DB_PORT=12154
ERP_HN_DB_NAME=database
ERP_HN_DB_USER=username
ERP_HN_DB_PASSWORD=password
ERP_HN_DB_ENCRYPT=false
```

## Prisma Commands

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Create a migration
npx prisma migrate dev --name your_migration_name

# Push schema changes without migration (for development)
npx prisma db push

# Open Prisma Studio to browse data
npx prisma studio
```

## Connection Pooling

- **RPA**: Prisma automatically manages connection pooling
- **ERP HCM**: Connection pool (max: 10, min: 0, idle timeout: 30s)
- **ERP HN**: Connection pool (max: 10, min: 0, idle timeout: 30s)

## Best Practices

1. **Use Prisma for new features**: Leverage type safety and schema management
2. **Use raw SQL for ERP databases**: These are legacy systems - avoid schema changes
3. **Always use parameterized queries**: Prevent SQL injection
4. **Handle errors**: Wrap database calls in try-catch blocks
5. **Close connections**: In API routes, connections auto-close. For long-running processes, manually close.

## Type Safety

### Prisma (RPA)
Types are automatically generated from your schema.

### Raw SQL (ERP databases)
Define your own types:

```typescript
interface Order {
  OrderId: number;
  CustomerId: number;
  Status: string;
  CreatedDate: Date;
}

const orders = await queryERPHCM<Order>('SELECT * FROM Orders');
// orders.recordset is typed as Order[]
```
