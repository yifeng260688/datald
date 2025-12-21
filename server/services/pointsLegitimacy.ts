import { LegitimatePoints, User, ILegitimatePoints, IUser } from "../models";
import crypto from "crypto";

const SUPER_ADMIN_EMAIL = "yifeng260688@gmail.com";

export interface LegitimacyValidationResult {
  isValid: boolean;
  reason?: string;
  legitPoints?: number;
  currentPoints?: number;
}

export async function recordLegitimateAward(
  userId: string,
  userEmail: string,
  amount: number,
  reason: string,
  adminEmail: string,
  relatedUploadId?: string
): Promise<boolean> {
  if (adminEmail !== SUPER_ADMIN_EMAIL) {
    console.log(`[PointsLegitimacy] Non-super admin ${adminEmail} attempted to award points - skipping whitelist update`);
    return false;
  }

  try {
    let legitRecord = await LegitimatePoints.findOne({ userId });
    
    if (!legitRecord) {
      legitRecord = new LegitimatePoints({
        _id: crypto.randomUUID(),
        userId,
        userEmail,
        totalLegitimatePoints: 0,
        totalPointsUsed: 0,
        awards: [],
      });
    }

    legitRecord.totalLegitimatePoints += amount;
    legitRecord.awards.push({
      amount,
      reason,
      awardedAt: new Date(),
      relatedUploadId,
    });
    legitRecord.lastAwardedAt = new Date();
    legitRecord.updatedAt = new Date();

    await legitRecord.save();
    console.log(`[PointsLegitimacy] Recorded ${amount} legitimate points for user ${userId}. Total: ${legitRecord.totalLegitimatePoints}`);
    return true;
  } catch (error) {
    console.error("[PointsLegitimacy] Error recording legitimate award:", error);
    return false;
  }
}

export async function recordPointsUsage(
  userId: string,
  amount: number
): Promise<boolean> {
  try {
    const legitRecord = await LegitimatePoints.findOne({ userId });
    if (legitRecord) {
      legitRecord.totalPointsUsed += amount;
      legitRecord.updatedAt = new Date();
      await legitRecord.save();
    }
    return true;
  } catch (error) {
    console.error("[PointsLegitimacy] Error recording points usage:", error);
    return false;
  }
}

export async function validateUserLegitimacy(
  userId: string
): Promise<LegitimacyValidationResult> {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { isValid: false, reason: "User not found" };
    }

    if (user.isBlocked) {
      return { isValid: false, reason: "Account is blocked" };
    }

    const currentPoints = user.points;
    
    if (currentPoints <= 0) {
      return { isValid: true, legitPoints: 0, currentPoints: 0 };
    }

    const legitRecord = await LegitimatePoints.findOne({ userId });
    
    if (!legitRecord) {
      return {
        isValid: false,
        reason: "User has points but no legitimate points record",
        legitPoints: 0,
        currentPoints,
      };
    }

    const availableLegitPoints = legitRecord.totalLegitimatePoints - legitRecord.totalPointsUsed;

    if (currentPoints > availableLegitPoints) {
      return {
        isValid: false,
        reason: `Điểm không hợp lệ: Hiện tại ${currentPoints}, Điểm hợp lệ còn lại ${availableLegitPoints}`,
        legitPoints: availableLegitPoints,
        currentPoints,
      };
    }

    return {
      isValid: true,
      legitPoints: availableLegitPoints,
      currentPoints,
    };
  } catch (error) {
    console.error("[PointsLegitimacy] Error validating legitimacy:", error);
    return { isValid: false, reason: "Validation error" };
  }
}

export async function blockUser(
  userId: string,
  reason: string
): Promise<boolean> {
  try {
    const result = await User.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          isBlocked: true,
          blockedReason: reason,
          blockedAt: new Date(),
          updatedAt: new Date(),
        }
      },
      { new: true }
    );
    
    if (result) {
      console.log(`[PointsLegitimacy] BLOCKED user ${userId}: ${reason}. isBlocked=${result.isBlocked}`);
      return true;
    }
    console.log(`[PointsLegitimacy] User ${userId} not found for blocking`);
    return false;
  } catch (error) {
    console.error("[PointsLegitimacy] Error blocking user:", error);
    return false;
  }
}

export async function unblockUser(userId: string): Promise<boolean> {
  try {
    const result = await User.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          isBlocked: false,
          updatedAt: new Date(),
        },
        $unset: {
          blockedReason: 1,
          blockedAt: 1,
        }
      },
      { new: true }
    );
    
    if (result) {
      console.log(`[PointsLegitimacy] UNBLOCKED user ${userId}. isBlocked=${result.isBlocked}`);
      return true;
    }
    console.log(`[PointsLegitimacy] User ${userId} not found for unblocking`);
    return false;
  } catch (error) {
    console.error("[PointsLegitimacy] Error unblocking user:", error);
    return false;
  }
}

export async function getLegitimatePointsRecord(
  userId: string
): Promise<ILegitimatePoints | null> {
  return LegitimatePoints.findOne({ userId });
}

export async function getAllUsersWithLegitimatePoints(): Promise<{
  userId: string;
  userEmail: string;
  totalLegitimatePoints: number;
  totalPointsUsed: number;
  availablePoints: number;
  lastAwardedAt?: Date;
}[]> {
  const records = await LegitimatePoints.find({}).sort({ totalLegitimatePoints: -1 });
  return records.map(r => ({
    userId: r.userId,
    userEmail: r.userEmail,
    totalLegitimatePoints: r.totalLegitimatePoints,
    totalPointsUsed: r.totalPointsUsed,
    availablePoints: r.totalLegitimatePoints - r.totalPointsUsed,
    lastAwardedAt: r.lastAwardedAt,
  }));
}

export { SUPER_ADMIN_EMAIL };
