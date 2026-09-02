pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use instructions::*;
use state::*;

declare_id!("8eGbY1MUKMSRoLTSPxen83hPWfT3zTuCVgj2UbS1kKsL");

pub const OAPP_SEED: &[u8] = b"OApp";
pub const AUTHORIZED_MESSAGE_SEED: &[u8] = b"AuthorizedMessage";
pub const PACKET_COUNTER_SEED: &[u8] = b"PacketCounter";

#[program]
pub mod endpoint {
    use super::*;

    pub fn register_oapp(mut ctx: Context<RegisterOApp>, params: RegisterOAppParams) -> Result<()> {
        RegisterOApp::apply(&mut ctx, &params)
    }

    pub fn authorize_message(
        mut ctx: Context<AuthorizeMessage>,
        params: AuthorizeMessageParams,
    ) -> Result<()> {
        AuthorizeMessage::apply(&mut ctx, &params)
    }

    pub fn send(mut ctx: Context<MockSend>, params: SendParams) -> Result<MessagingReceipt> {
        MockSend::apply(&mut ctx, &params)
    }

    pub fn set_mock_config(mut ctx: Context<SetMockConfig>, params: SetMockConfigParams) -> Result<()> {
        SetMockConfig::apply(&mut ctx, &params)
    }

    pub fn init_mock_packet_counter(mut ctx: Context<InitMockPacketCounter>) -> Result<()> {
        InitMockPacketCounter::apply(&mut ctx)
    }

    pub fn quote(ctx: Context<MockQuote>, params: QuoteParams) -> Result<MessagingFee> {
        MockQuote::apply(&ctx, &params)
    }

    pub fn clear(mut ctx: Context<MockClear>, params: ClearParams) -> Result<[u8; 32]> {
        MockClear::apply(&mut ctx, &params)
    }
}
