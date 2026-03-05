/* eslint-disable @typescript-eslint/no-unused-vars */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User as PrismaUser } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // In production, running without a secret is a critical security issue.
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  console.warn("JWT_SECRET is not set; using an insecure development fallback");
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || "dev_insecure_secret";

type User = PrismaUser;
type TokenRole = "USER" | "ADMIN";
type TokenPayload = { userId: string; role?: TokenRole; uv?: number };

// Check if we're on the server side
const isServer = typeof window === 'undefined';

export const generateToken = (userId: string, role: TokenRole, userVersion: number): string => {
  const token = jwt.sign({ userId, role, uv: userVersion }, EFFECTIVE_JWT_SECRET, { expiresIn: "1h" });
  return token;
};

export const verifyToken = (token: string): TokenPayload | null => {
  if (!token || token === "null" || token === "undefined") {
    return null;
  }
  
  // Only verify tokens on the server side
  if (!isServer) {
    // On client side, we'll just return null to avoid JWT library issues
    return null;
  }
  
  try {
    // Check if jwt is properly imported
    if (typeof jwt === 'undefined' || !jwt.verify) {
      console.error("JWT library not properly loaded");
      return null;
    }
    
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    // Only log in development to avoid console errors in production
    if (process.env.NODE_ENV === 'development') {
      console.error("Token verification error:", error);
    }
    return null;
  }
};

export const getSessionServer = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<User | null> => {
  const token = req.cookies["session_id"];
  if (!token) {
    return null;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !user.isActive) {
    return null;
  }

  // Invalidate old sessions when role changes (forces re-login with fresh permissions).
  if (!decoded.role || decoded.role !== user.role) {
    return null;
  }

  // Invalidate all existing sessions whenever the user record changes.
  // This revokes sessions after password resets/changes and admin security actions.
  if (typeof decoded.uv !== "number" || decoded.uv !== user.updatedAt.getTime()) {
    return null;
  }

  return user;
};

export const getSessionClient = async (): Promise<User | null> => {
  try {
    // On client side, we verify via the session endpoint.
    // Cookies are httpOnly; client JS should not try to read them.
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
    });

    if (response.ok) {
      const user = await response.json();
      return user;
    }

    return null;
  } catch (error) {
    // Only log in development to avoid console errors in production
    if (process.env.NODE_ENV === 'development') {
      console.error("Error in getSessionClient:", error);
    }
    return null;
  }
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};
