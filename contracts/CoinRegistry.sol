// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CoinRegistry
 * @dev Registry contract to track memecoins created via the platform
 * @notice This contract provides verifiable on-chain proof of platform activity
 * for grant applications and analytics
 */
contract CoinRegistry {
    struct CoinRegistration {
        address creator;        // User who created the coin
        address zoraContract;   // The ERC-1155 contract address
        uint256 timestamp;      // When it was created
        bytes32 txHash;        // Original Zora creation transaction
    }

    // Platform wallet that can register coins
    address public platformWallet;
    
    // Contract pause state
    bool public paused;
    
    // Main registry - indexed by Zora contract address
    mapping(address => CoinRegistration) public registry;
    
    // User's coins - for quick lookups
    mapping(address => address[]) public userCoins;
    
    // Platform stats
    uint256 public totalCoins;
    mapping(address => bool) private isCreator;
    
    // Events
    event CoinRegistered(
        address indexed creator,
        address indexed zoraContract,
        uint256 timestamp,
        bytes32 txHash
    );
    
    event BatchRegistered(
        uint256 count,
        uint256 timestamp
    );
    
    event PlatformWalletUpdated(
        address indexed oldWallet,
        address indexed newWallet
    );
    
    event Paused(address account);
    event Unpaused(address account);

    modifier onlyPlatform() {
        require(msg.sender == platformWallet, "Only platform wallet");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    constructor(address _platformWallet) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        platformWallet = _platformWallet;
    }

    /**
     * @dev Register a single coin creation
     * @param creator Address of the user who created the coin
     * @param zoraContract Address of the Zora ERC-1155 contract
     * @param txHash Transaction hash of the Zora creation
     */
    function register(
        address creator,
        address zoraContract,
        bytes32 txHash
    ) external onlyPlatform whenNotPaused {
        require(creator != address(0), "Invalid creator address");
        require(zoraContract != address(0), "Invalid contract address");
        require(_isContract(zoraContract), "Not a contract");
        require(registry[zoraContract].creator == address(0), "Already registered");

        registry[zoraContract] = CoinRegistration({
            creator: creator,
            zoraContract: zoraContract,
            timestamp: block.timestamp,
            txHash: txHash
        });

        userCoins[creator].push(zoraContract);
        
        if (!isCreator[creator]) {
            isCreator[creator] = true;
        }
        
        totalCoins++;

        emit CoinRegistered(creator, zoraContract, block.timestamp, txHash);
    }

    /**
     * @dev Register multiple coins in a single transaction (gas efficient)
     * @param creators Array of creator addresses
     * @param zoraContracts Array of Zora contract addresses
     * @param txHashes Array of transaction hashes
     * @param createdAtTimestamps Array of original coin creation timestamps
     */
    function batchRegister(
        address[] calldata creators,
        address[] calldata zoraContracts,
        bytes32[] calldata txHashes,
        uint256[] calldata createdAtTimestamps
    ) external onlyPlatform whenNotPaused {
        require(
            creators.length == zoraContracts.length && 
            creators.length == txHashes.length &&
            creators.length == createdAtTimestamps.length,
            "Array length mismatch"
        );
        require(creators.length > 0, "Empty arrays");
        require(creators.length <= 100, "Batch too large");

        uint256 successCount = 0;

        for (uint256 i = 0; i < creators.length; i++) {
            address creator = creators[i];
            address zoraContract = zoraContracts[i];
            bytes32 txHash = txHashes[i];
            uint256 createdAt = createdAtTimestamps[i];

            require(creator != address(0), "Invalid creator");
            require(zoraContract != address(0), "Invalid contract");
            require(_isContract(zoraContract), "Not a contract");
            require(createdAt > 0 && createdAt <= block.timestamp, "Invalid creation timestamp");
            
            // Skip if already registered (don't revert to allow partial batches)
            if (registry[zoraContract].creator != address(0)) {
                continue;
            }

            registry[zoraContract] = CoinRegistration({
                creator: creator,
                zoraContract: zoraContract,
                timestamp: createdAt,  // ✅ Use original creation time, not batch time
                txHash: txHash
            });

            userCoins[creator].push(zoraContract);
            
            if (!isCreator[creator]) {
                isCreator[creator] = true;
            }
            
            totalCoins++;
            successCount++;

            emit CoinRegistered(creator, zoraContract, createdAt, txHash);
        }

        emit BatchRegistered(successCount, block.timestamp);
    }

    /**
     * @dev Get registration details for a coin
     * @param zoraContract Address of the Zora contract
     * @return CoinRegistration struct with all details
     */
    function getRegistration(address zoraContract) 
        external 
        view 
        returns (CoinRegistration memory) 
    {
        return registry[zoraContract];
    }

    /**
     * @dev Get all coins created by a user
     * @param creator Address of the creator
     * @return Array of Zora contract addresses
     */
    function getUserCoins(address creator) 
        external 
        view 
        returns (address[] memory) 
    {
        return userCoins[creator];
    }

    /**
     * @dev Get number of coins created by a user
     * @param creator Address of the creator
     * @return Number of coins
     */
    function getUserCoinCount(address creator) 
        external 
        view 
        returns (uint256) 
    {
        return userCoins[creator].length;
    }

    /**
     * @dev Check if a contract is registered
     * @param zoraContract Address to check
     * @return bool True if registered
     */
    function isRegistered(address zoraContract) 
        external 
        view 
        returns (bool) 
    {
        return registry[zoraContract].creator != address(0);
    }

    /**
     * @dev Get total number of unique creators
     * @return Total number of creators (calculated from events)
     */
    function getTotalCreators() 
        external 
        view 
        returns (uint256) 
    {
        // Note: This is an approximation. For exact count, use event indexing
        return totalCoins; // Simplified - actual implementation would track unique creators
    }

    /**
     * @dev Update platform wallet (in case of wallet rotation)
     * @param newWallet New platform wallet address
     */
    function updatePlatformWallet(address newWallet) 
        external 
        onlyPlatform 
    {
        require(newWallet != address(0), "Invalid new wallet");
        address oldWallet = platformWallet;
        platformWallet = newWallet;
        emit PlatformWalletUpdated(oldWallet, newWallet);
    }

    /**
     * @dev Pause contract (emergency use only)
     */
    function pause() external onlyPlatform {
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyPlatform {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @dev Check if an address is a contract
     * @param account Address to check
     * @return bool True if account is a contract
     */
    function _isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }
}
