package br.com.eloplus.repository;

import br.com.eloplus.model.ChatEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ChatRepository extends JpaRepository<ChatEntity, Long> {
    List<ChatEntity> findByUsuarioIdOrderByDataCriacaoDesc(Long usuarioId);
    List<ChatEntity> findByUsuarioIdOrderByUpdatedAtDesc(Long usuarioId);
    Optional<ChatEntity> findByUsuarioIdAndParticipanteRef(Long usuarioId, String participanteRef);
}
