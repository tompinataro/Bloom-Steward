type ComposeOptions = {
  subject?: string;
  body?: string;
  recipients?: string[];
};

export async function isAvailableAsync() {
  return true;
}

export async function composeAsync(options: ComposeOptions) {
  const params = new URLSearchParams();
  if (options.subject) params.set('subject', options.subject);
  if (options.body) params.set('body', options.body);
  const recipients = options.recipients?.join(',') ?? '';
  window.location.href = `mailto:${recipients}${params.toString() ? `?${params.toString()}` : ''}`;
  return { status: 'sent' };
}
