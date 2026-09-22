import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async notifyRevocation(tokenId: string, ground: string): Promise<void> {
    // Stub: In production, send email/SMS to titleholder and registry office
    this.logger.log(`Revocation notification sent for tokenId=${tokenId}, ground=${ground}`);
  }
}
