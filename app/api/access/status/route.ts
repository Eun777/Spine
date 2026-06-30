import { NextResponse } from "next/server";
import { accessCodeConfigured, hasAiAccess } from "@/lib/ai-access";
import { getAuthenticatedUser } from "@/lib/supabase-server";
export async function GET(){if(!await getAuthenticatedUser())return NextResponse.json({error:"Authentication required"},{status:401});return NextResponse.json({configured:accessCodeConfigured(),unlocked:hasAiAccess()})}
