use crate::*;

#[account]
#[derive(InitSpace)]
pub struct OAppRegistry {
    pub delegate: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AuthorizedMessage {
    pub receiver: Pubkey,
    pub src_eid: u32,
    pub sender: [u8; 32],
    pub nonce: u64,
    pub guid: [u8; 32],
    pub payload_hash: [u8; 32],
    pub consumed: bool,
    pub bump: u8,
}
