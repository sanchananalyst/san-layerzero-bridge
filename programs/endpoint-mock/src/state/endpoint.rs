use crate::*;

#[account]
#[derive(InitSpace)]
pub struct OAppRegistry {
    pub delegate: Pubkey,
    pub send_library_configured: bool,
    pub receive_library_configured: bool,
    pub send_uln_configured: bool,
    pub receive_uln_configured: bool,
    pub executor_configured: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PacketCounter {
    pub count: u64,
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
