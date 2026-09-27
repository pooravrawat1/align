using System;

namespace Align.Networking
{
    public interface IAlignRoomTransport
    {
        event Action<RoomStateSnapshot> SnapshotReceived;
        event Action<string> TransportError;

        string ClientId { get; }
        bool IsConnected { get; }

        void SetLocalState(in LocalRoomState state);
        void RequestRoomReset();
        void RequestIntroductionReveal(string presentationId);
    }
}
