

## Project Overview

Stockly is designed to help businesses and individuals efficiently manage their product inventory. It provides a robust, full-stack solution with secure authentication, CRUD operations, filtering, sorting, analytics dashboard, QR code generation, data export capabilities, and a beautiful UI powered by shadcn/ui and Tailwind CSS. The project is open source and intended for learning, extension, and real-world use.

---

## 🚀 Features

### Core Functionality

- **Product Management**: Complete CRUD operations for products with SKU tracking
- **Category Management**: Organize products with custom categories
- **Supplier Management**: Track and manage product suppliers
- **Real-time Search**: Instant filtering by product name or SKU
- **Advanced Filtering**: Filter by category, supplier, and status
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark/Light Theme**: Toggle between themes with system preference detection

### Advanced Features

- **📊 Analytics Dashboard**: Comprehensive business insights with charts and metrics
- **📈 Data Visualization**: Interactive charts showing inventory trends and statistics
- **🔍 Advanced Search**: Enhanced search with multiple filter options
- **📱 QR Code Generation**: Generate QR codes for products with click-to-view functionality
- **📄 Data Export**: Export product data to CSV and Excel formats
- **📚 API Documentation**: Built-in API documentation page with endpoint details
- **🔧 API Status Monitor**: Real-time API health monitoring and status dashboard
- **⚠️ Low Stock Alerts**: Visual alerts for products with low inventory
- **📊 Performance Optimizations**: React memoization, lazy loading, and caching

### Authentication & Security

- **JWT Authentication**: Secure token-based authentication
- **User Registration**: Secure account creation with password hashing
- **Session Management**: Persistent login sessions with automatic token refresh
- **Protected Routes**: Automatic redirection for unauthenticated users
- **Password Security**: bcryptjs hashing for secure password storage

### User Experience

- **Loading States**: Visual feedback during all operations
- **Toast Notifications**: Success/error messages for all user actions
- **Form Validation**: Client-side validation with error handling
- **Accessibility**: ARIA-compliant components for screen readers
- **Keyboard Navigation**: Full keyboard accessibility support
- **Consistent Navigation**: AppHeader displayed on all authenticated pages

---

## 🛠️ Technology Stack

### Frontend

- **Next.js 15.5.11**: React framework with App Router
- **React 19**: Latest React with concurrent features
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: Modern component library
- **Zustand**: Lightweight state management
- **React Hook Form**: Form handling with validation
- **React Table**: Advanced table functionality
- **Recharts**: Data visualization and charting library
- **QRCode**: QR code generation library
- **Papaparse**: CSV parsing and generation
- **ExcelJS**: Excel file generation

### Backend

- **Next.js API Routes**: Server-side API endpoints
- **Prisma ORM**: Type-safe database operations
- **PostgreSQL**: SQL database
- **JWT**: JSON Web Token authentication
- **bcryptjs**: Password hashing
- **Axios**: HTTP client for API requests

### Development Tools

- **ESLint**: Code linting and formatting
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing
- **TypeScript**: Static type checking

---

## 📁 Project Structure

```bash
stockly/
├── app/                          # Next.js App Router
│   ├── AppHeader/                # Application header component
│   │   ├── AppHeader.tsx         # Main header with theme toggle
│   │   └── ModeToggle.tsx       # Dark/light theme toggle
│   ├── AppTable/                 # Main table component
│   │   ├── AppTable.tsx          # Main table wrapper
│   │   ├── dropdowns/            # Filter dropdowns
│   │   │   ├── CategoryDropDown.tsx
│   │   │   ├── StatusDropDown.tsx
│   │   │   └── SupplierDropDown.tsx
│   │   └── ProductDialog/        # Product management dialogs
│   │       ├── AddProductDialog.tsx
│   │       ├── AddCategoryDialog.tsx
│   │       ├── AddSupplierDialog.tsx
│   │       └── _components/      # Dialog sub-components
│   ├── Products/                 # Product-related components
│   │   ├── ProductTable.tsx      # Main product table
│   │   ├── columns.tsx           # Table column definitions
│   │   ├── ProductsDropDown.tsx  # Product action dropdown
│   │   └── PaginationSelection.tsx
│   ├── analytics/                # Analytics dashboard
│   │   └── page.tsx              # Analytics page with charts
│   ├── api-docs/                 # API documentation
│   │   └── page.tsx              # API docs page
│   ├── api-status/               # API status monitoring
│   │   └── page.tsx              # API status page
│   ├── login/                    # Authentication pages
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   ├── logout/
│   │   └── page.tsx
│   ├── authContext.tsx           # Authentication context
│   ├── useProductStore.ts        # Zustand store for state management
│   ├── types.ts                  # TypeScript type definitions
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Main page
│   └── Home.tsx                  # Home component
├── components/                   # Reusable UI components
│   ├── ui/                       # Shadcn/ui components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   ├── toast.tsx
│   │   ├── qr-code.tsx           # QR code component
│   │   ├── qr-code-hover.tsx     # QR code hover component
│   │   ├── analytics-card.tsx    # Analytics metrics card
│   │   ├── chart-card.tsx        # Chart wrapper component
│   │   ├── advanced-search.tsx  # Advanced search component
│   │   ├── forecasting-card.tsx  # Forecasting insights card
│   │   └── progress.tsx          # Progress bar component
│   ├── GlobalLoading.tsx         # Global loading component
│   ├── Loading.tsx               # Loading spinner
│   └── Skeleton.tsx              # Skeleton loading
├── pages/                        # API routes
│   └── api/
│       ├── auth/                 # Authentication endpoints
│       │   ├── login.ts
│       │   ├── register.ts
│       │   ├── logout.ts
│       │   └── session.ts
│       ├── products/             # Product management
│       │   └── index.ts
│       ├── categories/           # Category management
│       │   └── index.ts
│       └── suppliers/            # Supplier management
│           └── index.ts
├── prisma/                       # Database schema and client
│   ├── schema.prisma             # Database schema
│   ├── client.ts                 # Prisma client
│   ├── product.ts                # Product operations
│   ├── category.ts               # Category operations
│   └── supplier.ts               # Supplier operations
├── utils/                        # Utility functions
│   ├── auth.ts                   # Authentication utilities
│   └── axiosInstance.ts          # Axios configuration
├── hooks/                        # Custom React hooks
│   └── use-toast.ts              # Toast hook
├── middleware/                   # Next.js middleware
│   └── authMiddleware.ts         # Authentication middleware
├── middleware.ts                 # Route protection middleware
└── public/                       # Static assets
    ├── favicon.ico
    └── ...                       # Other static files
```

---

## 🚀 Getting Started

## ▶️ Como executar localmente (PT)

Este projeto é um Next.js full‑stack (App Router + API Routes) usando Prisma + PostgreSQL.

### 1) Pré‑requisitos

- Node.js `18.17+` (ou `20+` recomendado)
- `npm`
- PostgreSQL a correr localmente (ou via Docker)

### 2) Clonar e instalar dependências

```bash
git clone <URL_DO_REPO>
cd Stock-Inventory-Management-System--NextJS-FullStack
npm install
```

### 3) Configurar variáveis de ambiente (`.env`)

Cria um ficheiro `.env` na raiz (podes começar por copiar o `.env.example`):

```bash
cp .env.example .env
```

Edita o `.env` e ajusta pelo menos:

- `DATABASE_URL` (ligação ao Postgres)
- `JWT_SECRET` (segredo para assinar sessões)

Nota: para permitir registo via UI, define `ALLOW_REGISTRATION=true`.

### 4) Preparar a base de dados (Prisma)

```bash
# Cria/aplica migrações e gera o Prisma Client
npm run prisma:migrate
```

Opcional (ver dados):

```bash
npm run prisma:studio
```

### 5) Executar em desenvolvimento

```bash
npm run dev
```

Abrir no browser: `http://localhost:3000`

### 6) Build e execução em produção (local)

```bash
npm run build
npm run start
```

Em ambientes de deploy, normalmente também corres:

```bash
npx prisma migrate deploy
```

### Troubleshooting rápido

- Erro a ligar ao Postgres: confirma o serviço, user/password e `DATABASE_URL`.
- Registo desativado (HTTP 410): define `ALLOW_REGISTRATION=true`.
- CORS/Origin not allowed no login: define `ALLOWED_ORIGINS` com a lista de origens permitidas (separadas por vírgula).

---

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm** or **yarn**: Package manager
- **PostgreSQL**: Database (local instance)
- **Git**: Version control

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/stockly.git
   cd stockly
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup**

   Create a `.env` file in the root directory:

   ```env
   # Database Configuration
  DATABASE_URL="postgresql://stockly:stockly_password@localhost:5432/stockly?schema=public"

   # JWT Configuration
   JWT_SECRET="your-super-secret-jwt-key-here"
   # JWT_EXPIRES_IN="1h"

   # Application Configuration (Optional)
   # NEXTAUTH_URL="http://localhost:3000"
   # NEXTAUTH_SECRET="your-nextauth-secret"
   ```

4. **Database Setup**

   ```bash
   # Generate Prisma client
   npx prisma generate

  # Create/apply migrations (recommended)
  npx prisma migrate dev

   # (Optional) View database in Prisma Studio
   npx prisma studio
   ```

5. **Run the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 🔧 Environment Variables

### Required Variables

| Variable       | Description                         | Example |
| ------------- | ----------------------------------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string         | `postgresql://stockly:stockly_password@localhost:5432/stockly?schema=public` |
| `JWT_SECRET`   | Secret key to sign session JWTs      | `change-me-in-production` |

### Optional Variables

| Variable                  | Description | Default |
| ------------------------ | ----------- | ------- |
| `ALLOW_REGISTRATION`     | Enables registration endpoint (`/register`) when set to `true` | disabled |
| `ALLOWED_ORIGINS`        | Comma-separated allowed origins for cross-site login | empty |
| `NEXT_PUBLIC_API_BASE_URL` | API base URL (useful if front/back are split) | `/api` |

### Local PostgreSQL Setup (non-Docker)

1. Install PostgreSQL (Ubuntu/Debian example):

  ```bash
  sudo apt update
  sudo apt install -y postgresql postgresql-contrib
  ```

2. Create a database user and database:

  ```bash
  sudo -u postgres psql
  ```

  Inside `psql`:

  ```sql
  CREATE USER stockly WITH PASSWORD 'stockly_password';
  CREATE DATABASE stockly OWNER stockly;
  GRANT ALL PRIVILEGES ON DATABASE stockly TO stockly;
  ```

3. Set `DATABASE_URL` in `.env`:

  ```env
  DATABASE_URL="postgresql://stockly:stockly_password@localhost:5432/stockly?schema=public"
  ```

4. Run migrations:

  ```bash
  npx prisma migrate dev
  ```

---

## 📊 Database Schema

### User Model

```prisma
model User {
  id        String   @id @default(uuid()) @db.Uuid
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  email    String  @unique
  name     String
  password String
  username String? @unique
}
```

### Product Model

```prisma
model Product {
  id        String   @id @default(uuid()) @db.Uuid
  createdAt DateTime @default(now())

  name     String
  sku      String @unique
  price    Float
  quantity BigInt
  status   String

  userId     String @db.Uuid
  categoryId String @db.Uuid
  supplierId String @db.Uuid
}
```

### Category Model

```prisma
model Category {
  id     String @id @default(auto()) @map("_id") @db.ObjectId
  name   String
  userId String @db.ObjectId
}
```

### Supplier Model

```prisma
model Supplier {
  id     String @id @default(auto()) @map("_id") @db.ObjectId
  name   String
  userId String @db.ObjectId
}
```

---

## 🔌 API Endpoints

### Authentication Endpoints

This project is configured as **login-only** by default (accounts are created by an administrator). If you ever need to re-enable self-registration, set `ALLOW_REGISTRATION=true`.

### Roles / Pessoas

There is a simple role system:

- `USER` (default)
- `ADMIN` (can manage users)

To bootstrap the first admin locally, open Prisma Studio (`npm run prisma:studio`), edit a row in the `User` table and set `role` to `ADMIN`.

### Storage (Faturas / Requisições / Documentos / Outros)

There is a local file storage module:

- UI: `/storage` (tabs by type)
- API: `GET/POST /api/storage`, `GET/DELETE /api/storage/[id]`
- Files are stored on disk under `storage/<userId>/...` and indexed in Postgres (`StoredFile`).

#### POST `/api/auth/login`

Authenticate user and set a `session_id` HttpOnly cookie.

```typescript
// Request Body
{
  "email": "john@example.com",
  "password": "securepassword123"
}

// Response (cookie is set via Set-Cookie header)
{
  "userId": "...",
  "userName": "John Doe",
  "userEmail": "john@example.com"
}
```

#### POST `/api/auth/logout`

Logout user and invalidate session.

```typescript
// Response
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### GET `/api/auth/session`

Get current user session information.

```typescript
// Response
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Product Management Endpoints

#### GET `/api/products`

Get all products for the authenticated user.

```typescript
// Response
[
  {
    id: "507f1f77bcf86cd799439011",
    name: "Laptop",
    sku: "LAP001",
    price: 999.99,
    quantity: 10,
    status: "Available",
    category: "Electronics",
    supplier: "TechCorp",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
];
```

#### POST `/api/products`

Create a new product.

```typescript
// Request Body
{
  "name": "Laptop",
  "sku": "LAP001",
  "price": 999.99,
  "quantity": 10,
  "status": "Available",
  "categoryId": "507f1f77bcf86cd799439011",
  "supplierId": "507f1f77bcf86cd799439012"
}

// Response
{
  "id": "507f1f77bcf86cd799439013",
  "name": "Laptop",
  "sku": "LAP001",
  "price": 999.99,
  "quantity": 10,
  "status": "Available",
  "category": "Electronics",
  "supplier": "TechCorp",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### PUT `/api/products`

Update an existing product.

```typescript
// Request Body
{
  "id": "507f1f77bcf86cd799439013",
  "name": "Updated Laptop",
  "sku": "LAP001",
  "price": 1099.99,
  "quantity": 15,
  "status": "Available",
  "categoryId": "507f1f77bcf86cd799439011",
  "supplierId": "507f1f77bcf86cd799439012"
}
```

#### DELETE `/api/products`

Delete a product.

```typescript
// Request Body
{
  "id": "507f1f77bcf86cd799439013"
}

// Response
204 No Content
```

### Category Management Endpoints

#### GET `/api/categories`

Get all categories for the authenticated user.

#### POST `/api/categories`

Create a new category.

#### PUT `/api/categories`

Update an existing category.

#### DELETE `/api/categories`

Delete a category.

### Supplier Management Endpoints

#### GET `/api/suppliers`

Get all suppliers for the authenticated user.

#### POST `/api/suppliers`

Create a new supplier.

#### PUT `/api/suppliers`

Update an existing supplier.

#### DELETE `/api/suppliers`

Delete a supplier.

---

## 🎨 Component Architecture

### State Management with Zustand

The application uses Zustand for state management, providing a simple and efficient way to manage global state.

```typescript
// Example: Product Store
interface ProductState {
  allProducts: Product[];
  categories: Category[];
  suppliers: Supplier[];
  isLoading: boolean;
  loadProducts: () => Promise<void>;
  addProduct: (product: Product) => Promise<{ success: boolean }>;
  updateProduct: (product: Product) => Promise<{ success: boolean }>;
  deleteProduct: (id: string) => Promise<{ success: boolean }>;
}

export const useProductStore = create<ProductState>((set) => ({
  allProducts: [],
  categories: [],
  suppliers: [],
  isLoading: false,

  loadProducts: async () => {
    set({ isLoading: true });
    try {
      const response = await axiosInstance.get("/products");
      set({ allProducts: response.data || [] });
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      set({ isLoading: false });
    }
  },
  // ... other methods
}));
```

### Authentication Context

The authentication context provides user state and authentication methods throughout the application.

```typescript
// Example: Auth Context Usage
const { isLoggedIn, user, login, logout } = useAuth();

// Protected route example
useEffect(() => {
  if (!isLoggedIn) {
    router.push("/login");
  }
}, [isLoggedIn, router]);
```

### Reusable Components

#### Dialog Components

All dialogs follow a consistent pattern with proper accessibility attributes:

```typescript
// Example: Product Dialog
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent aria-describedby="product-dialog-description">
    <DialogHeader>
      <DialogTitle>Add Product</DialogTitle>
    </DialogHeader>
    <DialogDescription id="product-dialog-description">
      Fill in the product details below.
    </DialogDescription>
    {/* Form content */}
  </DialogContent>
</Dialog>
```

#### Table Components

The product table uses React Table for advanced functionality:

```typescript
// Example: Table Column Definition
const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "name",
    header: "Product Name",
    cell: ({ row }) => <div>{row.getValue("name")}</div>,
  },
  {
    accessorKey: "sku",
    header: "SKU",
  },
  // ... other columns
];
```

#### QR Code Component

QR code generation with click-to-view functionality:

```typescript
// Example: QR Code Usage
<QRCodeHover
  value={`Product: ${product.name}\nSKU: ${product.sku}\nPrice: $${product.price}`}
  title="View QR Code"
/>
```

#### Analytics Components

Reusable analytics cards and charts:

```typescript
// Example: Analytics Card
<AnalyticsCard
  title="Total Products"
  value={totalProducts}
  description="Total products in inventory"
  icon={<Package className="h-4 w-4" />}
/>
```

---

## 🔒 Security Features

### JWT Authentication

- Secure token-based authentication
- Automatic token refresh
- Protected API routes
- Session management

### Password Security

- bcryptjs hashing for passwords
- Secure password validation
- No plain text password storage

### API Security

- Request validation
- Error handling without sensitive data exposure
- CORS protection
- Rate limiting (can be implemented)

### Data Validation

- Client-side form validation
- Server-side data validation
- TypeScript type safety
- Prisma schema validation

---

## 🎯 Key Features Implementation

### Real-time Search

The search functionality filters products instantly as users type:

```typescript
// Search implementation in ProductTable.tsx
const filteredData = useMemo(() => {
  return data.filter((product) => {
    const searchMatch = searchTerm
      ? product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase())
      : true;

    return searchMatch && categoryFilter && supplierFilter && statusFilter;
  });
}, [data, searchTerm, categoryFilter, supplierFilter, statusFilter]);
```

### Toast Notifications

Consistent user feedback with toast notifications:

```typescript
// Example: Success toast
toast({
  title: "Success!",
  description: "Product created successfully.",
  variant: "default",
});

// Example: Error toast
toast({
  title: "Error",
  description: "Failed to create product. Please try again.",
  variant: "destructive",
});
```

### Loading States

Visual feedback during async operations:

```typescript
// Example: Button loading state
<Button disabled={isLoading}>
  {isLoading ? "Creating..." : "Create Product"}
</Button>
```

### Theme Toggle

Dark/light theme with system preference detection:

```typescript
// Theme toggle implementation
const { theme, setTheme } = useTheme();

const toggleTheme = () => {
  setTheme(theme === "dark" ? "light" : "dark");
};
```

### Data Export

CSV and Excel export functionality:

```typescript
// Example: Export to CSV
const exportToCSV = () => {
  const csv = Papa.unparse(filteredProducts);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "products.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
```

### Analytics Dashboard

Comprehensive business insights with charts:

```typescript
// Example: Analytics implementation
const analyticsData = useMemo(() => {
  return {
    totalProducts: products.length,
    totalValue: products.reduce(
      (sum, p) => sum + p.price * Number(p.quantity),
      0
    ),
    lowStockItems: products.filter((p) => Number(p.quantity) < 10).length,
    categories: categoryStats,
    monthlyTrends: monthlyData,
  };
}, [products]);
```

---

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Connect your GitHub repository to Vercel**
2. **Set environment variables in Vercel dashboard**
3. **Deploy automatically on push to main branch**

### Environment Variables for Production

```env
DATABASE_URL="your-production-mongodb-url"
JWT_SECRET="your-production-jwt-secret"
```

### Build Commands

```bash
# Build the application
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] User registration and login
- [ ] Product CRUD operations
- [ ] Category management
- [ ] Supplier management
- [ ] Search and filtering
- [ ] Theme toggle
- [ ] Responsive design
- [ ] Form validation
- [ ] Error handling
- [ ] Loading states
- [ ] Analytics dashboard
- [ ] QR code generation
- [ ] Data export (CSV/Excel)
- [ ] API documentation page
- [ ] API status monitoring

### Automated Testing (Future Enhancement)

```bash
# Install testing dependencies
npm install --save-dev jest @testing-library/react @testing-library/jest-dom

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

---

## 🔧 Customization

### Adding New Features

1. **Create new API endpoints** in `pages/api/`
2. **Add new Prisma models** in `schema.prisma`
3. **Create new components** in `components/`
4. **Update state management** in `useProductStore.ts`
5. **Add new routes** in `app/`

### Styling Customization

The application uses Tailwind CSS with custom design tokens:

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... other custom colors
      },
    },
  },
};
```

### Component Customization

All UI components are built with Shadcn/ui and can be customized:

```bash
# Add new Shadcn/ui components
npx shadcn@latest add [component-name]
```

---

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Issues

```bash
# Check connection/migration state
npx prisma migrate status

# Reset database (development only)
npx prisma migrate reset
```

#### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Authentication Issues

- Check JWT_SECRET environment variable
- Verify database connection
- Check user credentials in database

#### Performance Issues

- Enable Next.js production mode
- Optimize images and assets
- Use proper caching strategies

#### QR Code Issues

- Ensure QR code library is properly installed
- Check for hydration mismatches in development
- Verify client-side rendering for dynamic content

---

## 📚 Learning Resources

### Next.js

- [Next.js Documentation](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)
- [API Routes](https://nextjs.org/docs/api-routes/introduction)

### React

- [React Documentation](https://react.dev/)
- [React Hooks](https://react.dev/reference/react)
- [React Patterns](https://reactpatterns.com/)

### Prisma

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma with PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [Prisma Client](https://www.prisma.io/docs/concepts/components/prisma-client)

### Zustand

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Zustand Best Practices](https://github.com/pmndrs/zustand#best-practices)

### Tailwind CSS

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS Components](https://tailwindui.com/)

### Data Visualization

- [Recharts Documentation](https://recharts.org/)
- [Chart.js](https://www.chartjs.org/)

### QR Code Generation

- [QRCode Library](https://github.com/zpao/qrcode.react)

---

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
4. **Test thoroughly**
5. **Commit your changes**

   ```bash
   git commit -m "feat: add new feature"
   ```

6. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a pull request**

### Code Style Guidelines

- Use TypeScript for type safety
- Follow ESLint rules
- Write meaningful commit messages
- Add comments for complex logic
- Test your changes

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Next.js Team** for the amazing framework
- **Vercel** for hosting and deployment
- **Prisma Team** for the excellent ORM
- **Shadcn/ui** for the beautiful components
- **Tailwind CSS** for the utility-first CSS framework
- **Recharts** for the data visualization library

---

## 📞 Support

If you encounter any issues or have questions:

1. **Check the troubleshooting section**
2. **Search existing issues**
3. **Create a new issue** with detailed information
4. **Contact the maintainer**

---

## 🎯 Roadmap

### Planned Features

- [ ] User roles and permissions
- [ ] Advanced reporting and analytics
- [ ] Bulk import/export functionality
- [ ] Email notifications
- [ ] Mobile app
- [ ] API rate limiting
- [ ] Advanced search filters
- [ ] Product images
- [ ] Inventory alerts
- [ ] Audit logs
- [ ] Real-time notifications
- [ ] Advanced forecasting algorithms
- [ ] Multi-language support
- [ ] Advanced user preferences

### Performance Improvements

- [ ] Database indexing optimization
- [ ] Caching strategies
- [ ] Code splitting
- [ ] Image optimization
- [ ] Bundle size optimization
- [ ] Server-side rendering improvements
- [ ] Progressive Web App (PWA) features

---

## 📊 Project Statistics

- **Lines of Code**: ~8,000+
- **Components**: 30+
- **API Endpoints**: 12+
- **Database Models**: 4
- **Dependencies**: 40+
- **Pages**: 8+
- **Features**: 20+

---

## 🏆 Features Summary

| Feature                   | Status      | Description                            |
| ------------------------- | ----------- | -------------------------------------- |
| User Authentication       | ✅ Complete | JWT-based auth with registration/login |
| Product Management        | ✅ Complete | Full CRUD with search and filtering    |
| Category Management       | ✅ Complete | Create, edit, delete categories        |
| Supplier Management       | ✅ Complete | Manage product suppliers               |
| Responsive Design         | ✅ Complete | Mobile-first design                    |
| Dark/Light Theme          | ✅ Complete | Theme toggle with system preference    |
| Real-time Search          | ✅ Complete | Instant product filtering              |
| Toast Notifications       | ✅ Complete | User feedback system                   |
| Loading States            | ✅ Complete | Visual feedback during operations      |
| Form Validation           | ✅ Complete | Client and server-side validation      |
| Accessibility             | ✅ Complete | ARIA-compliant components              |
| TypeScript                | ✅ Complete | Full type safety                       |
| Database Integration      | ✅ Complete | PostgreSQL with Prisma ORM             |
| API Security              | ✅ Complete | Protected routes and validation        |
| Analytics Dashboard       | ✅ Complete | Business insights with charts          |
| QR Code Generation        | ✅ Complete | Product QR codes with click-to-view    |
| Data Export               | ✅ Complete | CSV and Excel export functionality     |
| API Documentation         | ✅ Complete | Built-in API docs page                 |
| API Status Monitor        | ✅ Complete | Real-time API health monitoring        |
| Performance Optimizations | ✅ Complete | React memoization and caching          |
| Low Stock Alerts          | ✅ Complete | Visual alerts for low inventory        |
| Advanced Search           | ✅ Complete | Enhanced search with multiple filters  |

---

## 🎉 Happy Coding! 🎉

Feel free to use this project repository and extend this project further!

If you have any questions or want to share your work, reach out via GitHub or my portfolio at [https://arnob-mahmud.vercel.app/](https://arnob-mahmud.vercel.app/).

**Enjoy building and learning!** 🚀

Thank you! 😊
# Stock
