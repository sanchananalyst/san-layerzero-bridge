use crate::*;
use anchor_lang::solana_program::keccak::hashv;

#[derive(Accounts)]
#[instruction(params: AuthorizeMessageParams)]
pub struct AuthorizeMessage<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [OAPP_SEED, params.receiver.as_ref()],
        bump = oapp_registry.bump,
        constraint = oapp_registry.delegate == authority.key() @ MockEndpointError::Unauthorized
    )]
    pub oapp_registry: Account<'info, OAppRegistry>,
    #[account(
        init,
        payer = authority,
        space = 8 + AuthorizedMessage::INIT_SPACE,
        seeds = [AUTHORIZED_MESSAGE_SEED, params.receiver.as_ref(), &params.guid],
        bump
    )]
    pub authorized_message: Account<'info, AuthorizedMessage>,
    pub system_program: Program<'info, System>,
}

impl AuthorizeMessage<'_> {
    pub fn apply(ctx: &mut Context<AuthorizeMessage>, params: &AuthorizeMessageParams) -> Result<()> {
        let authorized = &mut ctx.accounts.authorized_message;
        authorized.receiver = params.receiver;
        authorized.src_eid = params.src_eid;
        authorized.sender = params.sender;
        authorized.nonce = params.nonce;
        authorized.guid = params.guid;
        authorized.payload_hash = hashv(&[&params.guid, &params.message]).to_bytes();
        authorized.consumed = false;
        authorized.bump = ctx.bumps.authorized_message;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MockSend<'info> {
    pub sender: Signer<'info>,
    #[account(seeds = [OAPP_SEED, sender.key().as_ref()], bump = oapp_registry.bump)]
    pub oapp_registry: Account<'info, OAppRegistry>,
}

impl MockSend<'_> {
    pub fn apply(_ctx: &Context<MockSend>, params: &SendParams) -> Result<MessagingReceipt> {
        let guid = hashv(&[
            &params.dst_eid.to_be_bytes(),
            &params.receiver,
            &params.message,
        ])
        .to_bytes();
        Ok(MessagingReceipt {
            guid,
            nonce: 1,
            fee: MessagingFee { native_fee: 0, lz_token_fee: 0 },
        })
    }
}

#[derive(Accounts)]
#[instruction(params: ClearParams)]
pub struct MockClear<'info> {
    pub signer: Signer<'info>,
    #[account(
        seeds = [OAPP_SEED, params.receiver.as_ref()],
        bump = oapp_registry.bump,
        constraint = signer.key() == params.receiver @ MockEndpointError::Unauthorized
    )]
    pub oapp_registry: Account<'info, OAppRegistry>,
    /// CHECK: occupies the real Endpoint nonce-account position in the CPI interface.
    pub mock_nonce: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [AUTHORIZED_MESSAGE_SEED, params.receiver.as_ref(), &params.guid],
        bump = authorized_message.bump
    )]
    pub authorized_message: Account<'info, AuthorizedMessage>,
}

impl MockClear<'_> {
    pub fn apply(ctx: &mut Context<MockClear>, params: &ClearParams) -> Result<[u8; 32]> {
        let authorized = &mut ctx.accounts.authorized_message;
        let payload_hash = hashv(&[&params.guid, &params.message]).to_bytes();
        require!(!authorized.consumed, MockEndpointError::AlreadyConsumed);
        require!(authorized.receiver == params.receiver, MockEndpointError::InvalidMessage);
        require!(authorized.src_eid == params.src_eid, MockEndpointError::InvalidMessage);
        require!(authorized.sender == params.sender, MockEndpointError::InvalidMessage);
        require!(authorized.nonce == params.nonce, MockEndpointError::InvalidMessage);
        require!(authorized.guid == params.guid, MockEndpointError::InvalidMessage);
        require!(authorized.payload_hash == payload_hash, MockEndpointError::InvalidMessage);
        authorized.consumed = true;
        Ok(payload_hash)
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct AuthorizeMessageParams {
    pub receiver: Pubkey,
    pub src_eid: u32,
    pub sender: [u8; 32],
    pub nonce: u64,
    pub guid: [u8; 32],
    pub message: Vec<u8>,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SendParams {
    pub dst_eid: u32,
    pub receiver: [u8; 32],
    pub message: Vec<u8>,
    pub options: Vec<u8>,
    pub native_fee: u64,
    pub lz_token_fee: u64,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ClearParams {
    pub receiver: Pubkey,
    pub src_eid: u32,
    pub sender: [u8; 32],
    pub nonce: u64,
    pub guid: [u8; 32],
    pub message: Vec<u8>,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize, Default)]
pub struct MessagingFee {
    pub native_fee: u64,
    pub lz_token_fee: u64,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize, Default)]
pub struct MessagingReceipt {
    pub guid: [u8; 32],
    pub nonce: u64,
    pub fee: MessagingFee,
}

#[error_code]
pub enum MockEndpointError {
    #[msg("Unauthorized mock Endpoint operation")]
    Unauthorized,
    #[msg("Message does not match authenticated mock Endpoint state")]
    InvalidMessage,
    #[msg("Authenticated mock Endpoint message was already consumed")]
    AlreadyConsumed,
}
