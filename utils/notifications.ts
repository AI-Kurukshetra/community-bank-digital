// No third-party email library. Stub only.
// Replace with real provider after MVP launch.
export const sendEmail = async (
  to: string,
  subject: string,
  body: string
): Promise<void> => {
  console.log("[email stub]", { to, subject, body });
};
