// src/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';

dotenv.config();

// Role-aware protection middleware
export const protect = (roles = []) => (req, res, next) => {
  let token;
  
  // Check if authorization header exists and starts with Bearer
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      console.log('✅ JWT Decoded:', decoded);

      // Normalize user object - support both id formats
      req.user = {
        id: decoded.id || decoded._id || decoded.userId,  // Support multiple ID formats
        role: decoded.role || 'user',  // Default role if not specified
        email: decoded.email,
        name: decoded.name,
        ...decoded  // Include any other decoded properties
      };

      console.log('👤 Authenticated User:', req.user.id, 'Role:', req.user.role);

      // If specific roles are required, check user role
      if (roles.length && !roles.includes(req.user.role)) {
        return res.status(403).json({ 
          success: false,
          message: "Forbidden: Insufficient role privileges",
          requiredRoles: roles,
          userRole: req.user.role
        });
      }

      // Continue to next middleware/route handler
      next();
      
    } catch (error) {
      console.error('❌ JWT Verification Error:', error.message);
      
      // Handle specific JWT errors
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false,
          message: "Token expired - please login again",
          error: "TOKEN_EXPIRED"
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false,
          message: "Invalid token format",
          error: "INVALID_TOKEN"
        });
      }
      
      if (error.name === 'NotBeforeError') {
        return res.status(401).json({ 
          success: false,
          message: "Token not yet valid",
          error: "TOKEN_NOT_ACTIVE"
        });
      }
      
      return res.status(401).json({ 
        success: false,
        message: "Not authorized, token verification failed",
        error: "AUTH_FAILED"
      });
    }
  } else {
    return res.status(401).json({ 
      success: false,
      message: "Not authorized, no token provided",
      error: "NO_TOKEN",
      hint: "Include 'Authorization: Bearer <token>' in headers"
    });
  }
};

// Basic authentication middleware (no role checking)
export const authenticate = protect();

// Admin-only middleware
export const adminOnly = protect(['admin']);

// User or Admin middleware  
export const userOrAdmin = protect(['user', 'admin']);

// Manager or Admin middleware
export const managerOrAdmin = protect(['manager', 'admin']);

// Default export for backward compatibility
export default protect();
