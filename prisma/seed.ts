/**
 * Idempotent seeder. Reads existing _mock/*.json files and upserts rows into
 * Postgres so a fresh `pnpm db:seed` produces the exact dataset the storefront
 * currently renders from mocks.
 */
import { PrismaClient, Carrier, HeroKind, Size, UserRole } from "@prisma/client";
import { seedShipping as seedPhase4Shipping } from '../tests/seeds/shipping';
import { seedPromos } from '../tests/seeds/promo';
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

const ROOT = join(__dirname, "..", "src", "lib", "data", "_mock");

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(ROOT, file), "utf-8")) as T;
}

interface MockProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  description: string;
  images: string[];
  colour?: string;
  colourOptions?: { name: string; hex: string }[];
  sizes: Size[];
  categorySlugs: string[];
  stock: Partial<Record<Size, number>>;
  preOrder: boolean;
  details: { materials: string; care: string; sizing: string };
}

interface MockCategory {
  slug: string;
  name: string;
  description: string;
  bannerImage: string | null;
  sortOrder: number;
  meta: { title: string; description: string };
}

interface MockContent {
  announcement: { messages: string[] };
  hero: {
    kind: "image" | "video";
    image: string;
    videoUrl: string | null;
    eyebrow: string;
    ctaLabel: string;
    ctaHref: string;
  };
  staticPages: Array<{
    slug: string;
    title: string;
    bodyMarkdown: string;
    meta: { title: string; description: string };
  }>;
}

interface MockLookbook {
  images: Array<{ src: string; alt: string; productSlug: string | null }>;
}

interface MockSavedAddress {
  id: string;
  label: string;
  isDefault: boolean;
  address: {
    firstName: string;
    lastName: string;
    line1: string;
    line2: string | null;
    city: string;
    postcode: string;
    country: string;
    phone: string;
  };
}

async function seedCategories(): Promise<void> {
  const data = readJson<MockCategory[]>("categories.json");
  for (const c of data) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        bannerImage: c.bannerImage,
        sortOrder: c.sortOrder,
        metaTitle: c.meta.title,
        metaDescription: c.meta.description,
      },
      update: {
        name: c.name,
        description: c.description,
        bannerImage: c.bannerImage,
        sortOrder: c.sortOrder,
        metaTitle: c.meta.title,
        metaDescription: c.meta.description,
      },
    });
  }
}

async function seedProducts(): Promise<void> {
  const data = readJson<MockProduct[]>("products.json");
  for (const p of data) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        priceCents: p.price,
        materials: p.details.materials,
        care: p.details.care,
        sizing: p.details.sizing,
        preOrder: p.preOrder,
      },
      update: {
        name: p.name,
        description: p.description,
        priceCents: p.price,
        materials: p.details.materials,
        care: p.details.care,
        sizing: p.details.sizing,
        preOrder: p.preOrder,
      },
    });

    // Replace images
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    for (const [i, url] of p.images.entries()) {
      await prisma.productImage.create({
        data: { productId: product.id, url, sortOrder: i, alt: p.name },
      });
    }

    // Replace sizes / stock
    await prisma.productSize.deleteMany({ where: { productId: product.id } });
    for (const size of p.sizes) {
      await prisma.productSize.create({
        data: {
          productId: product.id,
          size,
          stock: p.stock[size] ?? 0,
        },
      });
    }

    // Replace colours
    await prisma.colourOption.deleteMany({ where: { productId: product.id } });
    if (p.colourOptions?.length) {
      for (const [i, c] of p.colourOptions.entries()) {
        await prisma.colourOption.create({
          data: { productId: product.id, name: c.name, hex: c.hex, sortOrder: i },
        });
      }
    } else if (p.colour) {
      await prisma.colourOption.create({
        data: { productId: product.id, name: p.colour, hex: "#000000", sortOrder: 0 },
      });
    }

    // Replace category links
    await prisma.productCategory.deleteMany({ where: { productId: product.id } });
    for (const slug of p.categorySlugs) {
      const cat = await prisma.category.findUnique({ where: { slug } });
      if (cat) {
        await prisma.productCategory.create({
          data: { productId: product.id, categoryId: cat.id },
        });
      }
    }
  }
}

async function seedCms(): Promise<void> {
  const content = readJson<MockContent>("content.json");
  const lookbook = readJson<MockLookbook>("lookbook.json");

  // Hero — single active row
  await prisma.heroBlock.deleteMany();
  await prisma.heroBlock.create({
    data: {
      kind: content.hero.kind === "video" ? HeroKind.VIDEO : HeroKind.IMAGE,
      imageUrl: content.hero.image,
      videoUrl: content.hero.videoUrl,
      eyebrow: content.hero.eyebrow,
      ctaLabel: content.hero.ctaLabel,
      ctaHref: content.hero.ctaHref,
      isActive: true,
    },
  });

  // Announcements
  await prisma.announcementMessage.deleteMany();
  for (const [i, text] of content.announcement.messages.entries()) {
    await prisma.announcementMessage.create({
      data: { text, sortOrder: i, isActive: true },
    });
  }

  // Lookbook
  await prisma.lookbookImage.deleteMany();
  for (const [i, img] of lookbook.images.entries()) {
    await prisma.lookbookImage.create({
      data: { src: img.src, alt: img.alt, productSlug: img.productSlug, sortOrder: i },
    });
  }

  // Static pages
  for (const page of content.staticPages) {
    await prisma.staticPage.upsert({
      where: { slug: page.slug },
      create: {
        slug: page.slug,
        title: page.title,
        bodyMarkdown: page.bodyMarkdown,
        metaTitle: page.meta.title,
        metaDescription: page.meta.description,
      },
      update: {
        title: page.title,
        bodyMarkdown: page.bodyMarkdown,
        metaTitle: page.meta.title,
        metaDescription: page.meta.description,
      },
    });
  }

  // SitePolicy singleton
  await prisma.sitePolicy.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

async function seedShipping(): Promise<void> {
  const zones = [
    {
      name: "United Kingdom",
      countries: ["GB"],
      methods: [
        {
          carrier: Carrier.ROYAL_MAIL,
          name: "Royal Mail Tracked 48",
          baseRateCents: 595,
          freeShipThresholdCents: 20000,
          estimatedDaysMin: 2,
          estimatedDaysMax: 4,
        },
        {
          carrier: Carrier.DHL,
          name: "DHL Express UK",
          baseRateCents: 1295,
          freeShipThresholdCents: null,
          estimatedDaysMin: 1,
          estimatedDaysMax: 2,
        },
      ],
    },
    {
      name: "European Union",
      countries: ["DE", "FR", "ES", "IT", "NL", "BE", "AT", "IE", "PT", "DK", "SE", "FI"],
      methods: [
        {
          carrier: Carrier.DHL,
          name: "DHL Express EU",
          baseRateCents: 1995,
          freeShipThresholdCents: 30000,
          estimatedDaysMin: 2,
          estimatedDaysMax: 4,
        },
      ],
    },
    {
      name: "Worldwide",
      countries: ["US", "CA", "AU", "AE", "SG", "JP", "HK"],
      methods: [
        {
          carrier: Carrier.DHL,
          name: "DHL Express Worldwide",
          baseRateCents: 2995,
          freeShipThresholdCents: null,
          estimatedDaysMin: 3,
          estimatedDaysMax: 6,
        },
      ],
    },
  ];

  // Idempotent: reset zones (and their methods cascade) then recreate
  await prisma.shippingMethod.deleteMany();
  await prisma.shippingZone.deleteMany();

  for (const [i, z] of zones.entries()) {
    const zone = await prisma.shippingZone.create({
      data: { name: z.name, countries: z.countries, sortOrder: i },
    });
    for (const [j, m] of z.methods.entries()) {
      await prisma.shippingMethod.create({
        data: {
          zoneId: zone.id,
          carrier: m.carrier,
          name: m.name,
          baseRateCents: m.baseRateCents,
          freeShipThresholdCents: m.freeShipThresholdCents,
          estimatedDaysMin: m.estimatedDaysMin,
          estimatedDaysMax: m.estimatedDaysMax,
          sortOrder: j,
        },
      });
    }
  }
}

async function seedUsers(): Promise<void> {
  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;
  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      "SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD must be set when running the seeder",
    );
  }

  const ownerHash = await bcrypt.hash(ownerPassword, 10);
  await prisma.user.upsert({
    where: { email: ownerEmail },
    create: {
      email: ownerEmail,
      passwordHash: ownerHash,
      name: "YNOT Owner",
      role: UserRole.OWNER,
      emailVerifiedAt: new Date(),
    },
    update: { passwordHash: ownerHash, role: UserRole.OWNER },
  });

  const customerEmail = "demo@ynot.london";
  const customerHash = await bcrypt.hash("demo-password-123", 10);
  const customer = await prisma.user.upsert({
    where: { email: customerEmail },
    create: {
      email: customerEmail,
      passwordHash: customerHash,
      name: "Demo Customer",
      role: UserRole.CUSTOMER,
      emailVerifiedAt: new Date(),
    },
    update: {},
  });

  // Demo address
  const addresses = readJson<MockSavedAddress[]>("addresses.json");
  if (addresses.length > 0) {
    const a = addresses[0];
    await prisma.address.deleteMany({ where: { userId: customer.id } });
    await prisma.address.create({
      data: {
        userId: customer.id,
        label: a.label,
        isDefault: a.isDefault,
        firstName: a.address.firstName,
        lastName: a.address.lastName,
        line1: a.address.line1,
        line2: a.address.line2,
        city: a.address.city,
        postcode: a.address.postcode,
        country: a.address.country,
        phone: a.address.phone,
      },
    });
  }
}

async function seedDemoOrder(): Promise<void> {
  const customer = await prisma.user.findUnique({ where: { email: "demo@ynot.london" } });
  if (!customer) return;
  const product = await prisma.product.findFirst({ where: { deletedAt: null } });
  if (!product) return;

  const orderNumber = "YN-2026-DEMO1";
  const existing = await prisma.order.findUnique({ where: { orderNumber } });
  if (existing) return;

  await prisma.order.create({
    data: {
      orderNumber,
      userId: customer.id,
      status: "DELIVERED",
      subtotalCents: product.priceCents,
      shippingCents: 595,
      totalCents: product.priceCents + 595,
      carrier: "ROYAL_MAIL",
      trackingNumber: "RM123456789GB",
      estimatedDeliveryDate: new Date(),
      shipFirstName: "Demo",
      shipLastName: "Customer",
      shipLine1: "1 Sample Street",
      shipCity: "London",
      shipPostcode: "E1 6AN",
      shipCountry: "GB",
      shipPhone: "+44 0000 000000",
      items: {
        create: {
          productId: product.id,
          productSlug: product.slug,
          productName: product.name,
          productImage: "/products/placeholder.jpg",
          colour: "Black",
          size: "M",
          unitPriceCents: product.priceCents,
          quantity: 1,
          isPreorder: false,
        },
      },
    },
  });
}

async function main() {
  console.log("Seeding YNOT London…");
  await seedCategories();
  console.log("  categories ✓");
  await seedProducts();
  console.log("  products + images + sizes + colours ✓");
  await seedCms();
  console.log("  CMS (hero, announcements, lookbook, static pages, sitePolicy) ✓");
  await seedShipping();
  console.log("  shipping zones + methods ✓");
  await seedUsers();
  console.log("  owner + demo customer + saved address ✓");
  await seedDemoOrder();
  console.log("  demo order ✓");
  await seedPhase4Shipping(prisma);
  console.log("  Phase 4 shipping zones + methods (fixed IDs) ✓");
  await seedPromos(prisma);
  console.log("  Phase 4 promo codes ✓");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
