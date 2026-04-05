"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

const FROM_ADDRESS = "PING <hi@openping.app>";

export const sendInvitationEmail = internalAction({
  args: {
    to: v.string(),
    inviterName: v.string(),
    workspaceName: v.string(),
    inviteToken: v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = process.env.APP_URL ?? "https://openping.app";
    const inviteUrl = `${appUrl}/invite/${args.inviteToken}`;

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: args.to,
      subject: `${args.inviterName} invited you to ${args.workspaceName} on PING`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 20px; font-weight: 600; color: #111; margin: 0;">PING</h1>
          </div>
          <p style="font-size: 15px; color: #333; line-height: 1.6; margin: 0 0 16px;">
            <strong>${args.inviterName}</strong> invited you to join <strong>${args.workspaceName}</strong> on PING.
          </p>
          <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 28px;">
            PING is an AI-native workspace for teams that want to communicate with clarity and focus.
          </p>
          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${inviteUrl}" style="display: inline-block; background: #7C3AED; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 500;">
              Accept invitation
            </a>
          </div>
          <p style="font-size: 12px; color: #999; line-height: 1.5; margin: 0;">
            This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Failed to send invitation email");
      throw new Error(`Failed to send invitation email: ${error.message}`);
    }
  },
});
