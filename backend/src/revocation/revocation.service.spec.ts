import { BadRequestException } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AuditService } from '../audit/audit.service';
import { MqttService } from '../mqtt/mqtt.service';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { NotificationService } from './notification.service';
import { RevocationService, RevocationGround } from './revocation.service';

describe('RevocationService', () => {
  const tokenId = '123';
  const governorId = 'governor-001';
  const governorKey = 'governor-private-key';
  let service: RevocationService;
  let order: string[];
  let blockchainMock: { revokeTitle: jest.Mock };
  let auditMock: { record: jest.Mock };
  let mqttMock: { publish: jest.Mock };
  let notificationMock: { notifyRevocation: jest.Mock };
  let supabaseMock: { raw: { from: jest.Mock } };
  let updates: Record<string, jest.Mock>;

  beforeEach(() => {
    order = [];
    blockchainMock = {
      revokeTitle: jest.fn().mockImplementation(async () => {
        order.push('blockchain');
        return '0xtransaction';
      }),
    };
    auditMock = {
      record: jest.fn().mockImplementation(async () => {
        order.push('audit');
      }),
    };
    mqttMock = {
      publish: jest.fn().mockImplementation(async () => {
        order.push('mqtt');
      }),
    };
    notificationMock = {
      notifyRevocation: jest.fn().mockImplementation(async () => {
        order.push('notification');
      }),
    };
    updates = {
      land_titles: jest.fn().mockImplementation(async () => {
        order.push('land_titles');
        return { error: null };
      }),
      parcels: jest.fn().mockImplementation(async () => {
        order.push('parcels');
        return { error: null };
      }),
    };
    const from = jest.fn((table: string) => ({
      update: jest.fn((values: Record<string, unknown>) => ({
        eq: jest.fn((column: string, value: string) => {
          expect(column).toBe('token_id');
          expect(value).toBe(tokenId);
          return updates[table]!(values);
        }),
      })),
    }));
    supabaseMock = { raw: { from } };

    service = new RevocationService(
      blockchainMock as unknown as BlockchainService,
      auditMock as unknown as AuditService,
      mqttMock as unknown as MqttService,
      supabaseMock as unknown as SupabaseClientService,
      notificationMock as unknown as NotificationService,
    );
  });

  it.each([
    ['OverridingPublicInterest', 0],
    ['BreachOfStatutoryCondition', 1],
  ] as const)(
    'performs the complete revocation sequence for %s',
    async (ground: RevocationGround, groundIndex: 0 | 1) => {
      await service.revoke(tokenId, ground, governorId, governorKey);

      expect(blockchainMock.revokeTitle).toHaveBeenCalledWith(
        123n,
        groundIndex,
        governorKey,
      );
      expect(updates.land_titles).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'revoked', revoked_at: expect.any(String) }),
      );
      expect(updates.parcels).toHaveBeenCalledWith({ status: 'reverted' });
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: tokenId,
          actorId: governorId,
          action: 'STATUTORY_REVOCATION',
          outcome: 'REVOKED',
          metadata: { ground, txHash: '0xtransaction' },
        }),
      );
      expect(mqttMock.publish).toHaveBeenCalledWith(
        'land/title/revoked',
        expect.objectContaining({
          tokenId,
          ground,
          revokedBy: governorId,
          timestamp: expect.any(String),
        }),
        2,
      );
      expect(notificationMock.notifyRevocation).toHaveBeenCalledWith(tokenId, ground);
      expect(order).toEqual([
        'blockchain',
        'land_titles',
        'parcels',
        'audit',
        'mqtt',
        'notification',
      ]);
    },
  );

  it('does not perform off-chain effects when on-chain revocation fails', async () => {
    blockchainMock.revokeTitle.mockRejectedValueOnce(new Error('chain unavailable'));

    await expect(
      service.revoke(tokenId, 'OverridingPublicInterest', governorId, governorKey),
    ).rejects.toThrow('chain unavailable');

    expect(supabaseMock.raw.from).not.toHaveBeenCalled();
    expect(auditMock.record).not.toHaveBeenCalled();
    expect(mqttMock.publish).not.toHaveBeenCalled();
    expect(notificationMock.notifyRevocation).not.toHaveBeenCalled();
  });

  it('stops subsequent effects if the title database update fails', async () => {
    updates.land_titles.mockResolvedValueOnce({
      error: { message: 'database unavailable' },
    });

    await expect(
      service.revoke(tokenId, 'OverridingPublicInterest', governorId, governorKey),
    ).rejects.toThrow('Failed to update land_titles');

    expect(updates.parcels).not.toHaveBeenCalled();
    expect(auditMock.record).not.toHaveBeenCalled();
    expect(mqttMock.publish).not.toHaveBeenCalled();
    expect(notificationMock.notifyRevocation).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '1.2', 'abc', ''])(
    'rejects invalid token ID %j before changing state',
    async (invalidTokenId) => {
      await expect(
        service.revoke(
          invalidTokenId,
          'OverridingPublicInterest',
          governorId,
          governorKey,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(blockchainMock.revokeTitle).not.toHaveBeenCalled();
    },
  );

  it('rejects an unsupported ground before changing state', async () => {
    await expect(
      service.revoke(
        tokenId,
        'InvalidGround' as RevocationGround,
        governorId,
        governorKey,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(blockchainMock.revokeTitle).not.toHaveBeenCalled();
  });
});
