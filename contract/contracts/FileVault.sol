// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FileVault {
    mapping(address => string[]) private userFiles;

    event FileAdded(address indexed user, string ipfsHash);
    event FileRemoved(address indexed user, string ipfsHash);

    function addFile(string memory ipfsHash) public {
        userFiles[msg.sender].push(ipfsHash);
        emit FileAdded(msg.sender, ipfsHash);
    }

    function removeFile(string memory ipfsHash) public {
        string[] storage files = userFiles[msg.sender];
        for (uint i = 0; i < files.length; i++) {
            if (keccak256(bytes(files[i])) == keccak256(bytes(ipfsHash))) {
                files[i] = files[files.length - 1];
                files.pop();
                emit FileRemoved(msg.sender, ipfsHash);
                return;
            }
        }
        revert("File not found");
    }

    function getFiles(address user) public view returns (string[] memory) {
        return userFiles[user];
    }
}