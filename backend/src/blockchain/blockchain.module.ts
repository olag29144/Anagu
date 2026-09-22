import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';

/**
 * BlockchainModule — encapsulates the ethers v6 integration with the
 * Hyperledger Besu QBFT node and the LandTitleNFT smart contract.
 *
 * Imports `ConfigModule` to make `ConfigService` available for reading
 * `BESU_RPC_URL`, `REGISTRAR_PRIVATE_KEY`, and `LAND_TITLE_NFT_ADDRESS`
 * from the application environment.
 */
@Module({
  imports: [ConfigModule],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
